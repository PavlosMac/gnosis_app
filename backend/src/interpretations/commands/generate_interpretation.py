from datetime import date

import structlog

from src.auth.repository import AuthWriteRepository
from src.cqrs.commands import BaseCommand, CommandHandler
from src.interpretations.schemas import (
    CardInterpretationReadModel,
    GeneratedInterpretationResponse,
)
from src.llm.port import LLMPort
from src.llm.schemas import CardInSpread, InterpretationRequest, InterpretationSettings
from src.readings.repository import ReadingReadRepository
from src.readings.service import ReadingNotFoundError

logger = structlog.stdlib.get_logger(__name__)


class GenerateInterpretationCommand(BaseCommand):
    reading_id: str
    user_id: str
    settings: InterpretationSettings


class GenerateInterpretationHandler(
    CommandHandler[GenerateInterpretationCommand, GeneratedInterpretationResponse]
):
    def __init__(
        self,
        reading_read_repo: ReadingReadRepository,
        user_write_repo: AuthWriteRepository,
        llm: LLMPort,
    ) -> None:
        self._reading_read_repo = reading_read_repo
        self._user_write_repo = user_write_repo
        self._llm = llm

    async def handle(
        self, command: GenerateInterpretationCommand
    ) -> GeneratedInterpretationResponse:
        reading = await self._reading_read_repo.find_owned(command.reading_id, command.user_id)
        if reading is None:
            raise ReadingNotFoundError()

        llm_request = InterpretationRequest(
            spread_name=reading["spread_type"],
            question=reading.get("question"),
            birth_date=(
                date.fromisoformat(reading["birth_date"]) if reading.get("birth_date") else None
            ),
            cards=[
                CardInSpread(
                    name=card["name"],
                    position=card["position"],
                    orientation=card["orientation"],
                    position_description=card.get("position_description"),
                )
                for card in reading["cards"]
            ],
            settings=command.settings,
        )
        llm_response = await self._llm.generate_interpretation(llm_request)

        # Counted whether or not the result is ever saved — a generate call costs the same
        # either way, and a future credit feature needs the real number.
        await self._user_write_repo.increment_tokens_used(command.user_id, llm_response.tokens_used)
        logger.debug(
            "generated interpretation preview",
            reading_id=command.reading_id,
            lens=command.settings.lens.value,
            intent=command.settings.intent.value,
            tokens_used=llm_response.tokens_used,
        )

        return GeneratedInterpretationResponse(
            card_interpretations=[
                CardInterpretationReadModel.model_validate(ci.model_dump())
                for ci in llm_response.card_interpretations
            ],
            synthesis=llm_response.synthesis,
            model=llm_response.model,
            tokens_used=llm_response.tokens_used,
            settings=command.settings,
        )
