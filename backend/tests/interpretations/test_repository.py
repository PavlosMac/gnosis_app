import pytest
from bson import ObjectId

from src.interpretations.models import Interpretation
from src.interpretations.repository import (
    InterpretationReadRepository,
    InterpretationWriteRepository,
)

_SETTINGS = {"style": "reflective", "depth": 60, "tone": 50}


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


async def test_upsert_by_reading_id_creates_new_document(repos):
    write_repo, read_repo = repos
    reading_id = str(ObjectId())
    user_id = str(ObjectId())
    interpretation = _make_interpretation(reading_id, user_id)

    await write_repo.upsert_by_reading_id(reading_id, interpretation.to_document())

    doc = await read_repo.find_by_reading_id(reading_id)
    assert doc is not None
    assert str(doc["reading_id"]) == reading_id
    assert str(doc["user_id"]) == user_id
    assert doc["synthesis"] == "A journey begins."
    assert doc["settings"] == _SETTINGS


async def test_upsert_by_reading_id_replaces_existing_document(repos):
    write_repo, read_repo = repos
    reading_id = str(ObjectId())
    user_id = str(ObjectId())

    await write_repo.upsert_by_reading_id(
        reading_id, _make_interpretation(reading_id, user_id).to_document()
    )
    first_doc = await read_repo.find_by_reading_id(reading_id)
    esoteric_settings = {"style": "esoteric", "depth": 90, "tone": 20}
    await write_repo.upsert_by_reading_id(
        reading_id,
        _make_interpretation(reading_id, user_id, settings=esoteric_settings).to_document(),
    )

    doc = await read_repo.find_by_reading_id(reading_id)
    assert doc["settings"] == esoteric_settings
    count = await read_repo.count({"reading_id": ObjectId(reading_id)})
    assert count == 1
    assert doc["created_at"] == first_doc["created_at"]


async def test_find_by_reading_id_returns_none_when_missing(repos):
    _, read_repo = repos
    result = await read_repo.find_by_reading_id(str(ObjectId()))
    assert result is None


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
