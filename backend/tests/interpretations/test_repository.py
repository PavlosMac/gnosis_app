import pytest
from bson import ObjectId

from src.interpretations.models import Interpretation
from src.interpretations.repository import (
    InterpretationReadRepository,
    InterpretationWriteRepository,
)

_SETTINGS = {"lens": "traditional", "intent": "reflective", "depth": 60}


@pytest.fixture
def repos(mock_db):
    return InterpretationWriteRepository(mock_db), InterpretationReadRepository(mock_db)


def _make_interpretation(
    reading_id: str, user_id: str, settings: dict | None = None
) -> Interpretation:
    return Interpretation(
        reading_id=reading_id,
        user_id=user_id,
        card_interpretations=[
            {
                "card_name": "The Fool",
                "position": "Present",
                "orientation": "upright",
                "interpretation": "New beginnings.",
            }
        ],
        synthesis="A journey begins.",
        tokens_used=42,
        model="mock",
        settings=settings or dict(_SETTINGS),
    )


async def test_upsert_creates_new_document(repos):
    write_repo, read_repo = repos
    reading_id = str(ObjectId())
    user_id = str(ObjectId())
    interpretation = _make_interpretation(reading_id, user_id)

    await write_repo.upsert_by_lens(reading_id, interpretation.to_document())

    doc = await read_repo.find_by_lens(reading_id, "traditional")
    assert doc is not None
    assert str(doc["reading_id"]) == reading_id
    assert str(doc["user_id"]) == user_id
    assert doc["synthesis"] == "A journey begins."
    assert doc["settings"] == _SETTINGS


async def test_upsert_replaces_the_same_lens_and_keeps_created_at(repos):
    write_repo, read_repo = repos
    reading_id = str(ObjectId())
    user_id = str(ObjectId())

    await write_repo.upsert_by_lens(
        reading_id, _make_interpretation(reading_id, user_id).to_document()
    )
    first_doc = await read_repo.find_by_lens(reading_id, "traditional")

    predictive = {"lens": "traditional", "intent": "predictive", "depth": 90}
    await write_repo.upsert_by_lens(
        reading_id,
        _make_interpretation(reading_id, user_id, settings=predictive).to_document(),
    )

    doc = await read_repo.find_by_lens(reading_id, "traditional")
    assert doc["settings"] == predictive
    assert await read_repo.count({"reading_id": ObjectId(reading_id)}) == 1
    assert doc["created_at"] == first_doc["created_at"]


async def test_a_different_lens_gets_its_own_document(repos):
    write_repo, read_repo = repos
    reading_id = str(ObjectId())
    user_id = str(ObjectId())

    await write_repo.upsert_by_lens(
        reading_id, _make_interpretation(reading_id, user_id).to_document()
    )
    esoteric = {"lens": "esoteric", "intent": "reflective", "depth": 60}
    await write_repo.upsert_by_lens(
        reading_id,
        _make_interpretation(reading_id, user_id, settings=esoteric).to_document(),
    )

    docs = await read_repo.find_all_by_reading_id(reading_id)
    assert len(docs) == 2
    assert {d["settings"]["lens"] for d in docs} == {"traditional", "esoteric"}


async def test_find_by_lens_returns_none_when_missing(repos):
    _, read_repo = repos
    assert await read_repo.find_by_lens(str(ObjectId()), "traditional") is None


async def test_find_all_returns_empty_list_when_missing(repos):
    _, read_repo = repos
    assert await read_repo.find_all_by_reading_id(str(ObjectId())) == []


def test_interpretation_round_trips_through_document():
    reading_id = str(ObjectId())
    user_id = str(ObjectId())
    interpretation = _make_interpretation(reading_id, user_id)
    interpretation.id = str(ObjectId())

    restored = Interpretation.from_document(interpretation.to_document())

    assert restored.reading_id == reading_id
    assert restored.user_id == user_id
    assert restored.settings == _SETTINGS
    assert restored.synthesis == "A journey begins."
    assert restored.tokens_used == 42


async def test_upsert_by_lens_keys_off_the_documents_own_settings_lens(repos):
    """upsert_by_lens takes only the document — the slot it writes to is derived from
    document["settings"]["lens"], so there is no separate lens argument that could ever
    diverge from what actually gets stored."""
    write_repo, read_repo = repos
    reading_id = str(ObjectId())
    user_id = str(ObjectId())
    esoteric = {"lens": "esoteric", "intent": "reflective", "depth": 60}

    await write_repo.upsert_by_lens(
        reading_id, _make_interpretation(reading_id, user_id, settings=esoteric).to_document()
    )

    assert await read_repo.find_by_lens(reading_id, "esoteric") is not None
    assert await read_repo.find_by_lens(reading_id, "traditional") is None
