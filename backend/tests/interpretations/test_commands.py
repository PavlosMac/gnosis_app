import asyncio

import pytest
from bson import ObjectId

from src.auth.repository import AuthReadRepository, AuthWriteRepository
from src.auth.service import BudgetExceededError
from src.core.config import settings as app_settings
from src.core.exceptions import UnauthorizedError
from src.interpretations.commands.generate_interpretation import GenerateInterpretationCommand
from src.interpretations.repository import InterpretationWriteRepository
from src.llm.errors import LLMResponseError
from src.llm.port import LLMPort
from src.llm.schemas import (
    CardInSpread,
    InterpretationRequest,
    InterpretationResponse,
    LLMUsage,
)
from src.readings.commands.create_reading import CreateReadingCommand
from src.readings.service import ReadingNotFoundError


async def _user_usage(mock_db, user_id: str) -> dict:
    doc = await AuthReadRepository(mock_db).find_by_id(user_id)
    return (doc or {}).get("usage", {})


def _generate_command(reading_id: str, user_id: str):
    return GenerateInterpretationCommand(reading_id=reading_id, user_id=user_id)


# --- Generate: response shape + persistence ---


async def test_generate_interpretation_returns_reading(generate_handler, make_reading, user_id):
    reading = await make_reading()
    result = await generate_handler.handle(_generate_command(reading.id, user_id))
    assert "The Fool" in result.interpretation.reading
    assert result.interpretation.model == "mock"


async def test_generate_interpretation_carries_usage_and_remaining_budget(
    generate_handler, make_reading, user_id
):
    reading = await make_reading()
    result = await generate_handler.handle(_generate_command(reading.id, user_id))
    # The mock adapter reports zero-cost usage, so nothing is charged.
    assert result.interpretation.usage.cost_usd == 0.0
    assert result.interpretation.usage.model == "mock"
    assert result.remaining_budget_usd == app_settings.user_budget_usd


async def test_generate_persists_the_interpretation(
    generate_handler, make_reading, user_id, mock_db
):
    """One step: the interpretation is stored the moment it is generated — there is no
    separate save call, and the stored document carries no settings."""
    reading = await make_reading()
    result = await generate_handler.handle(_generate_command(reading.id, user_id))

    assert await mock_db["interpretations"].count_documents({}) == 1
    doc = await mock_db["interpretations"].find_one({})
    assert doc["reading"] == result.interpretation.reading
    assert doc["model"] == "mock"
    assert doc["usage"]["cost_usd"] == 0.0
    assert "settings" not in doc
    # The response echoes the stored document, ids and timestamps included.
    assert str(doc["_id"]) == result.interpretation.id
    assert doc["created_at"] == result.interpretation.created_at


async def test_generate_interpretation_not_found(generate_handler, user_id):
    with pytest.raises(ReadingNotFoundError):
        await generate_handler.handle(_generate_command(str(ObjectId()), user_id))


async def test_generate_interpretation_malformed_reading_id_returns_not_found(
    generate_handler, user_id
):
    """reading_id comes straight off the URL path with no format validation — the
    interpretation lookup runs concurrently with the ownership check via asyncio.gather,
    so a malformed id must 404 like the ownership check does, not raise InvalidId."""
    with pytest.raises(ReadingNotFoundError):
        await generate_handler.handle(_generate_command("not-an-object-id", user_id))


async def test_generate_interpretation_raises_unauthorized_when_user_record_is_missing(
    generate_handler, make_reading, user_id, mock_db
):
    """A deleted account with a still-valid access token must surface as an auth error,
    not as a misleading 'budget exhausted' — reserve_usage's find_one_and_update simply
    can't match a document that doesn't exist, which is a different failure than an
    exhausted budget and must not be reported as one."""
    reading = await make_reading()
    await mock_db["users"].delete_one({"_id": ObjectId(user_id)})

    with pytest.raises(UnauthorizedError):
        await generate_handler.handle(_generate_command(reading.id, user_id))


async def test_generate_interpretation_wrong_user(generate_handler, make_reading, user_id, mock_db):
    reading = await make_reading()
    other_user = ObjectId()
    await mock_db["users"].insert_one({"_id": other_user, "email": "other@example.com"})
    with pytest.raises(ReadingNotFoundError):
        await generate_handler.handle(_generate_command(reading.id, str(other_user)))


# --- Idempotency: one interpretation per reading, generated once ---


class _FakeLLM(LLMPort):
    """Reports a fixed usage split, optionally failing or blocking on an event.
    Counts calls so idempotency tests can assert the LLM was not touched."""

    def __init__(
        self,
        usage: LLMUsage | None = None,
        model: str = "gpt-5.4-2026-01-01",
        error: Exception | None = None,
        gate: asyncio.Event | None = None,
    ) -> None:
        self.usage = usage or LLMUsage()
        self.model = model
        self.error = error
        self.gate = gate
        self.calls = 0

    async def generate_interpretation(
        self, request: InterpretationRequest
    ) -> InterpretationResponse:
        self.calls += 1
        if self.gate is not None:
            await self.gate.wait()
        if self.error is not None:
            raise self.error
        return InterpretationResponse(
            reading="A woven reading.", model=self.model, usage=self.usage
        )

    async def close(self) -> None:
        pass


async def test_second_generate_is_idempotent_and_does_not_charge(
    generate_handler_factory, mock_db, make_reading, user_id
):
    """A reading that already has its interpretation gets the stored one back: no LLM
    call, no reservation, no charge — this is what they get, no more."""
    llm = _FakeLLM(usage=LLMUsage(prompt_tokens=1000, completion_tokens=2000))
    handler = generate_handler_factory(llm)
    reading = await make_reading()

    first = await handler.handle(_generate_command(reading.id, user_id))
    second = await handler.handle(_generate_command(reading.id, user_id))

    assert llm.calls == 1
    assert await mock_db["interpretations"].count_documents({}) == 1
    assert second.interpretation.id == first.interpretation.id
    assert second.interpretation.reading == first.interpretation.reading
    usage = await _user_usage(mock_db, user_id)
    assert usage["readings"] == 1
    assert usage["cost_usd"] == pytest.approx(first.interpretation.usage.cost_usd)
    assert second.remaining_budget_usd == pytest.approx(first.remaining_budget_usd)


async def test_idempotent_path_computes_remaining_budget_from_current_aggregate(
    generate_handler_factory, mock_db, make_reading, user_id, generate_handler
):
    reading = await make_reading()
    await generate_handler.handle(_generate_command(reading.id, user_id))
    # Spend recorded after the interpretation was stored (e.g. other paid features).
    await mock_db["users"].update_one(
        {"_id": ObjectId(user_id)}, {"$set": {"usage": {"cost_usd": 1.25}}}
    )

    llm = _FakeLLM()
    result = await generate_handler_factory(llm).handle(_generate_command(reading.id, user_id))

    assert llm.calls == 0
    assert result.remaining_budget_usd == pytest.approx(app_settings.user_budget_usd - 1.25)


async def test_concurrent_generates_leave_one_document(
    generate_handler_factory, mock_db, make_reading, user_id
):
    """Two generates racing past the existence check both write, but the upsert is keyed
    on reading_id alone: last write wins, one document — the double charge is the same
    accepted race the budget gate already bounds."""
    gate = asyncio.Event()
    llm = _FakeLLM(gate=gate)
    handler = generate_handler_factory(llm)
    reading = await make_reading()

    first = asyncio.create_task(handler.handle(_generate_command(reading.id, user_id)))
    second = asyncio.create_task(handler.handle(_generate_command(reading.id, user_id)))
    await asyncio.sleep(0.01)  # let both pass the existence check and block in the LLM
    gate.set()
    await asyncio.gather(first, second)

    assert llm.calls == 2
    assert await mock_db["interpretations"].count_documents({}) == 1


# --- Budget gate: reserve, settle, release ---


async def test_generate_settles_exact_actuals_onto_the_user_aggregate(
    generate_handler_factory, mock_db, make_reading, user_id
):
    llm = _FakeLLM(usage=LLMUsage(prompt_tokens=1000, completion_tokens=2000, reasoning_tokens=500))
    handler = generate_handler_factory(llm)
    reading = await make_reading()

    result = await handler.handle(_generate_command(reading.id, user_id))

    # gpt-5.4 prices: $2.50/1M in, $15.00/1M out.
    expected_cost = 1000 / 1e6 * 2.50 + 2000 / 1e6 * 15.00
    usage = await _user_usage(mock_db, user_id)
    assert usage["cost_usd"] == pytest.approx(expected_cost)
    assert usage["prompt_tokens"] == 1000
    assert usage["completion_tokens"] == 2000
    assert usage["readings"] == 1
    assert usage["updated_at"] is not None
    assert result.interpretation.usage.cost_usd == pytest.approx(expected_cost)
    assert result.remaining_budget_usd == pytest.approx(
        app_settings.user_budget_usd - expected_cost
    )


async def test_generate_refuses_when_budget_exhausted(
    generate_handler_factory, mock_db, make_reading, user_id
):
    handler = generate_handler_factory(_FakeLLM())
    reading = await make_reading()
    await mock_db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"usage": {"cost_usd": app_settings.user_budget_usd}}},
    )

    with pytest.raises(BudgetExceededError):
        await handler.handle(_generate_command(reading.id, user_id))


async def test_generate_allows_while_under_budget(
    generate_handler_factory, mock_db, make_reading, user_id
):
    handler = generate_handler_factory(_FakeLLM())
    reading = await make_reading()
    await mock_db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"usage": {"cost_usd": app_settings.user_budget_usd - 0.01}}},
    )

    result = await handler.handle(_generate_command(reading.id, user_id))
    assert result.interpretation.reading


async def test_per_user_budget_override_beats_the_default(
    generate_handler_factory, mock_db, make_reading, user_id
):
    handler = generate_handler_factory(_FakeLLM())
    # Spend beyond the default cap, but under a raised per-user override.
    await mock_db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "usage": {"cost_usd": app_settings.user_budget_usd + 1.0},
                "budget_usd": app_settings.user_budget_usd + 5.0,
            }
        },
    )

    result = await handler.handle(_generate_command((await make_reading()).id, user_id))
    assert result.interpretation.reading

    # And a lowered override refuses spend the default would have allowed — checked on a
    # fresh reading, since the first one's stored interpretation would be returned free.
    await mock_db["users"].update_one({"_id": ObjectId(user_id)}, {"$set": {"budget_usd": 0.5}})
    with pytest.raises(BudgetExceededError):
        await handler.handle(_generate_command((await make_reading()).id, user_id))


async def test_zero_budget_override_blocks_even_a_brand_new_users_first_request(
    generate_handler_factory, mock_db, make_reading, user_id
):
    """budget_usd=0 must be enforced literally: not treated as unset and defaulted (the
    handler previously did `budget_usd or default`, which is falsy for 0), and not
    exempted because the user's usage aggregate doesn't exist yet on their first-ever
    call (the repository previously carved out an unconditional pass for that case)."""
    handler = generate_handler_factory(_FakeLLM())
    reading = await make_reading()
    await mock_db["users"].update_one({"_id": ObjectId(user_id)}, {"$set": {"budget_usd": 0.0}})

    with pytest.raises(BudgetExceededError):
        await handler.handle(_generate_command(reading.id, user_id))


async def test_failed_call_releases_the_reservation(
    generate_handler_factory, mock_db, make_reading, user_id
):
    """The user is never charged for a reading they didn't receive."""
    handler = generate_handler_factory(_FakeLLM(error=LLMResponseError()))
    reading = await make_reading()

    with pytest.raises(LLMResponseError):
        await handler.handle(_generate_command(reading.id, user_id))

    usage = await _user_usage(mock_db, user_id)
    assert usage.get("cost_usd", 0.0) == pytest.approx(0.0)
    assert "readings" not in usage


class _FailingInterpretationWriteRepo(InterpretationWriteRepository):
    async def upsert_by_reading_id(self, reading_id, document):
        raise RuntimeError("persist failed")


async def test_persist_failure_releases_the_reservation(
    generate_handler_factory, mock_db, make_reading, user_id
):
    """Persist sits between the LLM call and the settle, inside reserve_budget: if the
    write fails, the reservation is released — charged-with-nothing-stored is
    impossible."""
    llm = _FakeLLM(usage=LLMUsage(prompt_tokens=1000, completion_tokens=2000))
    handler = generate_handler_factory(
        llm, interpretation_write_repo=_FailingInterpretationWriteRepo(mock_db)
    )
    reading = await make_reading()

    with pytest.raises(RuntimeError, match="persist failed"):
        await handler.handle(_generate_command(reading.id, user_id))

    assert await mock_db["interpretations"].count_documents({}) == 0
    usage = await _user_usage(mock_db, user_id)
    assert usage.get("cost_usd", 0.0) == pytest.approx(0.0)
    assert "readings" not in usage


class _FailingSettleAuthRepo(AuthWriteRepository):
    async def settle_usage(self, *args, **kwargs):
        raise RuntimeError("settle failed")


async def test_settle_failure_keeps_the_stored_interpretation_and_charges_nothing(
    generate_handler_factory, mock_db, make_reading, user_id
):
    """If settle fails after a successful persist, the reservation release nets the
    charge to $0 while the interpretation stays stored — errs in the user's favor."""
    llm = _FakeLLM(usage=LLMUsage(prompt_tokens=1000, completion_tokens=2000))
    handler = generate_handler_factory(llm, user_write_repo=_FailingSettleAuthRepo(mock_db))
    reading = await make_reading()

    with pytest.raises(RuntimeError, match="settle failed"):
        await handler.handle(_generate_command(reading.id, user_id))

    assert await mock_db["interpretations"].count_documents({}) == 1
    usage = await _user_usage(mock_db, user_id)
    assert usage.get("cost_usd", 0.0) == pytest.approx(0.0)


async def test_concurrent_requests_cannot_stack_overshoot(
    generate_handler_factory, mock_db, make_reading, user_id
):
    """The gate is one filtered find_one_and_update: while a reservation is in flight,
    a second request already sees the reserved spend and is refused — the cap can be
    exceeded by at most one reservation, not one per parallel request."""
    gate = asyncio.Event()
    handler = generate_handler_factory(_FakeLLM(gate=gate))
    reading = await make_reading()
    # A budget smaller than one worst-case reservation: the first request reserves past
    # the cap, the second must be refused while the first is still in flight.
    await mock_db["users"].update_one({"_id": ObjectId(user_id)}, {"$set": {"budget_usd": 0.001}})

    first = asyncio.create_task(handler.handle(_generate_command(reading.id, user_id)))
    await asyncio.sleep(0.01)  # let the first request reserve and block in the LLM call
    with pytest.raises(BudgetExceededError):
        await handler.handle(_generate_command(reading.id, user_id))
    gate.set()
    await first


async def test_generate_interpretation_for_card_without_position(
    generate_handler, create_reading_handler, user_id
):
    reading = await create_reading_handler.handle(
        CreateReadingCommand(
            user_id=user_id,
            spread_name="Three Card Relationship",
            cards=[CardInSpread(name="The Fool", orientation="upright")],
        )
    )
    result = await generate_handler.handle(_generate_command(reading.id, user_id))
    assert "The Fool" in result.interpretation.reading
