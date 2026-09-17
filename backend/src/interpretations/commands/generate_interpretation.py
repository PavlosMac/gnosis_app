import asyncio

import structlog

from src.auth.repository import AuthReadRepository, AuthWriteRepository
from src.auth.service import effective_budget_usd, remaining_budget_usd, reserve_budget
from src.core.exceptions import UnauthorizedError
from src.cqrs.commands import BaseCommand, CommandHandler
from src.interpretations.models import Interpretation
from src.interpretations.repository import (
    InterpretationReadRepository,
    InterpretationWriteRepository,
)
from src.interpretations.schemas import (
    GeneratedInterpretationResponse,
    InterpretationReadModel,
    InterpretationUsage,
)
from src.llm.port import LLMPort
from src.llm.pricing import cost_usd, worst_case_cost_usd
from src.llm.schemas import CardInSpread, InterpretationRequest
from src.readings.repository import ReadingReadRepository
from src.readings.service import ReadingNotFoundError

logger = structlog.stdlib.get_logger(__name__)


class GenerateInterpretationCommand(BaseCommand):
    reading_id: str
    user_id: str


class GenerateInterpretationHandler(
    CommandHandler[GenerateInterpretationCommand, GeneratedInterpretationResponse]
):
    """Generate-or-return: one interpretation per reading, persisted the moment it is
    generated. A repeat call returns the stored interpretation without touching the LLM
    or the budget — the endpoint is idempotent."""

    def __init__(
        self,
        reading_read_repo: ReadingReadRepository,
        user_read_repo: AuthReadRepository,
        user_write_repo: AuthWriteRepository,
        interpretation_read_repo: InterpretationReadRepository,
        interpretation_write_repo: InterpretationWriteRepository,
        llm: LLMPort,
    ) -> None:
        self._reading_read_repo = reading_read_repo
        self._user_read_repo = user_read_repo
        self._user_write_repo = user_write_repo
        self._interpretation_read_repo = interpretation_read_repo
        self._interpretation_write_repo = interpretation_write_repo
        self._llm = llm

    async def handle(
        self, command: GenerateInterpretationCommand
    ) -> GeneratedInterpretationResponse:
        # Independent lookups — reading, budget override, and any stored interpretation
        # have no data dependency on each other — run concurrently rather than as three
        # sequential round trips.
        reading, user, existing = await asyncio.gather(
            self._reading_read_repo.find_owned(command.reading_id, command.user_id),
            self._user_read_repo.find_by_id(command.user_id),
            self._interpretation_read_repo.find_by_reading_id(command.reading_id),
        )
        # Ownership before idempotency: an existing interpretation on someone else's
        # reading must still 404, never leak.
        if reading is None:
            raise ReadingNotFoundError()
        # An access token can outlive the account it was issued for (e.g. the user was
        # deleted). reserve_usage's filtered find_one_and_update simply can't match a
        # document that doesn't exist, which would otherwise surface as a misleading
        # "budget exhausted" — this is an auth problem, not a budget one.
        if user is None:
            raise UnauthorizedError("User not found")

        budget = effective_budget_usd(user)

        if existing is not None:
            logger.debug(
                "interpretation already exists — returning stored, no charge",
                reading_id=command.reading_id,
            )
            return GeneratedInterpretationResponse(
                interpretation=InterpretationReadModel.model_validate(existing),
                remaining_budget_usd=remaining_budget_usd(user, budget),
            )

        llm_request = InterpretationRequest(
            spread_name=reading["spread_type"],
            question=reading.get("question"),
            cards=[
                CardInSpread(
                    name=card["name"],
                    position=card.get("position"),
                    orientation=card["orientation"],
                    position_description=card.get("position_description"),
                )
                for card in reading["cards"]
            ],
        )

        # Reserve worst-case cost atomically before the call; settle to actuals after.
        # Persist sits between the LLM call and the settle, all inside reserve_budget:
        # on ANY failure the reservation is released, so a persist failure leaves the
        # user uncharged with nothing stored, and a settle failure leaves the doc stored
        # but charged $0 — charged-with-nothing-stored is impossible. (Wasted provider
        # spend is logged and absorbed.)
        reserved = worst_case_cost_usd(llm_request)

        async with reserve_budget(self._user_write_repo, command.user_id, reserved, budget):
            llm_response = await self._llm.generate_interpretation(llm_request)
            actual_cost = cost_usd(
                llm_response.usage.prompt_tokens,
                llm_response.usage.completion_tokens,
                llm_response.model,
            )
            interpretation = Interpretation(
                reading_id=command.reading_id,
                user_id=command.user_id,
                reading=llm_response.reading,
                model=llm_response.model,
                usage=InterpretationUsage(
                    prompt_tokens=llm_response.usage.prompt_tokens,
                    completion_tokens=llm_response.usage.completion_tokens,
                    reasoning_tokens=llm_response.usage.reasoning_tokens,
                    model=llm_response.model,
                    cost_usd=actual_cost,
                ).model_dump(mode="json"),
            )
            stored = await self._interpretation_write_repo.upsert_by_reading_id(
                command.reading_id, interpretation.to_document()
            )
            total_spend = await self._user_write_repo.settle_usage(
                command.user_id,
                reserved_usd=reserved,
                actual_cost_usd=actual_cost,
                prompt_tokens=llm_response.usage.prompt_tokens,
                completion_tokens=llm_response.usage.completion_tokens,
            )

        logger.debug(
            "generated and stored interpretation",
            reading_id=command.reading_id,
            cost_usd=actual_cost,
            total_spend_usd=total_spend,
        )

        return GeneratedInterpretationResponse(
            interpretation=InterpretationReadModel.model_validate(stored),
            remaining_budget_usd=max(budget - total_spend, 0.0),
        )
