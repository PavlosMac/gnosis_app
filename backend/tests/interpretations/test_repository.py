import pytest
from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from src.interpretations.models import Interpretation
from src.interpretations.repository import (
    InterpretationReadRepository,
    InterpretationWriteRepository,
)
from tests.factories import make_usage

_USAGE = make_usage(
    prompt_tokens=480,
    completion_tokens=723,
    reasoning_tokens=329,
    model="gpt-5.4-2026-01-01",
    cost_usd=0.012,
)


@pytest.fixture
def repos(mock_db):
    return InterpretationWriteRepository(mock_db), InterpretationReadRepository(mock_db)


def _make_interpretation(
    reading_id: str, user_id: str, reading: str = "A journey begins."
) -> Interpretation:
    return Interpretation(
        reading_id=reading_id,
        user_id=user_id,
        reading=reading,
        model="mock",
        usage=dict(_USAGE),
    )


async def test_upsert_creates_new_document(repos):
    write_repo, read_repo = repos
    reading_id = str(ObjectId())
    user_id = str(ObjectId())
    interpretation = _make_interpretation(reading_id, user_id)

    await write_repo.upsert_by_reading_id(reading_id, interpretation.to_document())

    doc = await read_repo.find_by_reading_id(reading_id)
    assert doc is not None
    assert str(doc["reading_id"]) == reading_id
    assert str(doc["user_id"]) == user_id
    assert doc["reading"] == "A journey begins."
    assert doc["usage"] == _USAGE


async def test_find_by_reading_id_with_malformed_id_returns_none(repos):
    """A malformed reading_id is indistinguishable from not-found here, matching the
    guard ReadingReadRepository.find_owned already applies — the two lookups run
    concurrently in GenerateInterpretationHandler, so this one must not raise."""
    _, read_repo = repos
    assert await read_repo.find_by_reading_id("not-an-object-id") is None


async def test_upsert_retries_as_plain_update_on_duplicate_key_race(repos, mock_db, monkeypatch):
    """find_one_and_update(upsert=True) against the unique reading_id index can still
    raise E11000 when two requests race the same brand-new key — MongoDB's documented
    upsert-race caveat, not something the unique index alone rules out. The retry must
    fall back to a plain update against the now-existing document rather than crash."""
    write_repo, _ = repos
    reading_id = str(ObjectId())
    user_id = str(ObjectId())
    # Simulate a concurrent request having already created the document by the time
    # ours attempts its upsert.
    await mock_db["interpretations"].insert_one(
        _make_interpretation(reading_id, user_id, reading="First writer's reading.").to_document()
    )

    original = write_repo._collection.find_one_and_update
    raised = False

    async def find_one_and_update_racy(filter_, update, *, upsert=False, return_document=None):
        nonlocal raised
        if upsert and not raised:
            raised = True
            raise DuplicateKeyError("E11000 duplicate key error collection")
        return await original(filter_, update, upsert=upsert, return_document=return_document)

    monkeypatch.setattr(write_repo._collection, "find_one_and_update", find_one_and_update_racy)

    stored = await write_repo.upsert_by_reading_id(
        reading_id,
        _make_interpretation(reading_id, user_id, reading="Second writer's reading.").to_document(),
    )

    assert stored["reading"] == "Second writer's reading."
    assert await mock_db["interpretations"].count_documents({}) == 1


async def test_upsert_returns_the_stored_document(repos):
    """find_one_and_update(AFTER) hands the handler _id and created_at in the same round
    trip as the write — on the insert and on the replace, with a stable _id."""
    write_repo, _ = repos
    reading_id = str(ObjectId())
    user_id = str(ObjectId())

    inserted = await write_repo.upsert_by_reading_id(
        reading_id, _make_interpretation(reading_id, user_id).to_document()
    )
    assert inserted["_id"] is not None
    assert inserted["reading"] == "A journey begins."

    replaced = await write_repo.upsert_by_reading_id(
        reading_id,
        _make_interpretation(reading_id, user_id, reading="A revised narrative.").to_document(),
    )
    assert replaced["_id"] == inserted["_id"]
    assert replaced["reading"] == "A revised narrative."


async def test_upsert_replaces_the_readings_one_slot_and_keeps_created_at(repos):
    """One interpretation per reading: a second write for the same reading replaces the
    first — one document, original created_at preserved."""
    write_repo, read_repo = repos
    reading_id = str(ObjectId())
    user_id = str(ObjectId())

    await write_repo.upsert_by_reading_id(
        reading_id, _make_interpretation(reading_id, user_id).to_document()
    )
    first_doc = await read_repo.find_by_reading_id(reading_id)

    await write_repo.upsert_by_reading_id(
        reading_id,
        _make_interpretation(reading_id, user_id, reading="A revised narrative.").to_document(),
    )

    doc = await read_repo.find_by_reading_id(reading_id)
    assert doc["reading"] == "A revised narrative."
    assert await read_repo.count({"reading_id": ObjectId(reading_id)}) == 1
    assert doc["created_at"] == first_doc["created_at"]


async def test_different_readings_get_their_own_documents(repos):
    write_repo, read_repo = repos
    user_id = str(ObjectId())
    first_reading = str(ObjectId())
    second_reading = str(ObjectId())

    await write_repo.upsert_by_reading_id(
        first_reading, _make_interpretation(first_reading, user_id).to_document()
    )
    await write_repo.upsert_by_reading_id(
        second_reading, _make_interpretation(second_reading, user_id).to_document()
    )

    assert await read_repo.find_by_reading_id(first_reading) is not None
    assert await read_repo.find_by_reading_id(second_reading) is not None
    assert await read_repo.count({}) == 2


async def test_find_by_reading_id_returns_none_when_missing(repos):
    _, read_repo = repos
    assert await read_repo.find_by_reading_id(str(ObjectId())) is None


def test_interpretation_round_trips_through_document():
    reading_id = str(ObjectId())
    user_id = str(ObjectId())
    interpretation = _make_interpretation(reading_id, user_id)
    interpretation.id = str(ObjectId())

    restored = Interpretation.from_document(interpretation.to_document())

    assert restored.reading_id == reading_id
    assert restored.user_id == user_id
    assert restored.reading == "A journey begins."
    assert restored.usage == _USAGE


def test_interpretation_without_usage_omits_the_field():
    """Documents migrated from before the usage ledger have no usage sub-doc — the
    model must not store usage: null."""
    interpretation = Interpretation(
        reading_id=str(ObjectId()),
        user_id=str(ObjectId()),
        reading="x",
        model="mock",
    )
    assert "usage" not in interpretation.to_document()
