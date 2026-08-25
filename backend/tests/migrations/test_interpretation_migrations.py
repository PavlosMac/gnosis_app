"""Migrations 005, 006 and 007 — the interpretations collection, its backfill, and the
repair migration for environments that ran the pre-lens 005/006.

005 and 006 were edited in place rather than superseded, even though the pre-lens
versions were already committed and pushed on this branch. 007 repairs any environment
that ran those pre-lens versions: it drops the stale single-field unique index on
reading_id and remaps documents stuck in the old style/depth/tone settings shape.
"""

import importlib
from datetime import UTC, datetime

from bson import ObjectId

from src.database.collections.constants import INTERPRETATIONS_COLLECTION, READINGS_COLLECTION

m005 = importlib.import_module("src.migrations.versions.005_interpretations_indexes")
m006 = importlib.import_module("src.migrations.versions.006_backfill_interpretations")
m007 = importlib.import_module("src.migrations.versions.007_repair_legacy_interpretation_settings")


def _legacy_reading(user_id: ObjectId) -> dict:
    """A reading from before interpretations were their own collection."""
    return {
        "_id": ObjectId(),
        "user_id": user_id,
        "spread_type": "Celtic Cross",
        "cards": [{"name": "The Fool", "position": "Present", "orientation": "upright"}],
        "card_interpretations": [
            {
                "card_name": "The Fool",
                "position": "Present",
                "orientation": "upright",
                "interpretation": "New beginnings.",
            }
        ],
        "synthesis": "A journey begins.",
        "tokens_used": 1234,
        "model": "gpt-4o",
        "created_at": datetime(2026, 1, 1, tzinfo=UTC),
    }


async def test_005_creates_the_compound_unique_index(mock_db):
    await m005.up(mock_db)

    indexes = await mock_db[INTERPRETATIONS_COLLECTION].index_information()
    wanted = ["reading_id", "settings.lens"]
    compound = next(
        (v for v in indexes.values() if [k for k, _ in v["key"]] == wanted),
        None,
    )
    assert compound is not None, f"compound index missing from {indexes}"
    assert compound.get("unique") is True


async def test_006_backfills_with_lens_and_intent(mock_db):
    user_id = ObjectId()
    reading = _legacy_reading(user_id)
    await mock_db[READINGS_COLLECTION].insert_one(reading)

    await m006.up(mock_db)

    doc = await mock_db[INTERPRETATIONS_COLLECTION].find_one({"reading_id": reading["_id"]})
    assert doc is not None
    assert doc["settings"] == {"lens": "traditional", "intent": "reflective", "depth": 60}
    assert "style" not in doc["settings"]
    assert "tone" not in doc["settings"]
    assert doc["synthesis"] == "A journey begins."
    assert doc["tokens_used"] == 1234
    # BSON has no timezone — Mongo hands datetimes back naive, in UTC.
    assert doc["created_at"].replace(tzinfo=UTC) == reading["created_at"]


async def test_006_is_idempotent(mock_db):
    reading = _legacy_reading(ObjectId())
    await mock_db[READINGS_COLLECTION].insert_one(reading)

    await m006.up(mock_db)
    first = await mock_db[INTERPRETATIONS_COLLECTION].find_one({"reading_id": reading["_id"]})
    await m006.up(mock_db)

    assert await mock_db[INTERPRETATIONS_COLLECTION].count_documents({}) == 1
    again = await mock_db[INTERPRETATIONS_COLLECTION].find_one({"reading_id": reading["_id"]})
    assert again["_id"] == first["_id"]


async def test_006_skips_readings_with_no_embedded_interpretation(mock_db):
    reading = _legacy_reading(ObjectId())
    del reading["card_interpretations"]
    del reading["synthesis"]
    await mock_db[READINGS_COLLECTION].insert_one(reading)

    await m006.up(mock_db)

    assert await mock_db[INTERPRETATIONS_COLLECTION].count_documents({}) == 0


async def test_007_drops_the_stale_single_field_unique_index(mock_db):
    """Simulates a DB that ran the pre-lens version of 005."""
    collection = mock_db[INTERPRETATIONS_COLLECTION]
    await collection.create_index("reading_id", unique=True)

    await m007.up(mock_db)

    indexes = await collection.index_information()
    assert not any(
        [k for k, _ in info["key"]] == ["reading_id"] and info.get("unique")
        for info in indexes.values()
    )
    wanted = ["reading_id", "settings.lens"]
    compound = next((v for v in indexes.values() if [k for k, _ in v["key"]] == wanted), None)
    assert compound is not None
    assert compound.get("unique") is True


def _legacy_interpretation_doc(settings: dict, **overrides) -> dict:
    doc = {
        "reading_id": ObjectId(),
        "user_id": ObjectId(),
        "card_interpretations": [],
        "synthesis": "x",
        "tokens_used": 0,
        "model": "mock",
        "settings": settings,
        "created_at": datetime(2026, 1, 1, tzinfo=UTC),
        "updated_at": datetime(2026, 1, 1, tzinfo=UTC),
    }
    doc.update(overrides)
    return doc


async def test_007_remaps_legacy_style_tone_settings_to_lens_intent(mock_db):
    """Simulates a document written by the pre-lens version of 006 (or the old
    POST /interpretation endpoint)."""
    collection = mock_db[INTERPRETATIONS_COLLECTION]
    doc = _legacy_interpretation_doc(
        {"style": "reflective", "depth": 60, "tone": 50},
        synthesis="A journey begins.",
        tokens_used=1234,
        model="gpt-4o",
    )
    reading_id = doc["reading_id"]
    await collection.insert_one(doc)

    await m007.up(mock_db)

    doc = await collection.find_one({"reading_id": reading_id})
    assert doc["settings"] == {"lens": "traditional", "intent": "reflective", "depth": 60}
    assert "style" not in doc["settings"]
    assert "tone" not in doc["settings"]
    # Untouched fields survive the remap.
    assert doc["synthesis"] == "A journey begins."
    assert doc["tokens_used"] == 1234


async def test_007_leaves_already_migrated_documents_alone(mock_db):
    collection = mock_db[INTERPRETATIONS_COLLECTION]
    settings = {"lens": "esoteric", "intent": "predictive", "depth": 90}
    doc = _legacy_interpretation_doc(settings)
    reading_id = doc["reading_id"]
    await collection.insert_one(doc)

    await m007.up(mock_db)

    doc = await collection.find_one({"reading_id": reading_id})
    assert doc["settings"] == settings


async def test_007_is_idempotent(mock_db):
    collection = mock_db[INTERPRETATIONS_COLLECTION]
    await collection.create_index("reading_id", unique=True)
    doc = _legacy_interpretation_doc({"style": "reflective", "depth": 60, "tone": 50})
    reading_id = doc["reading_id"]
    await collection.insert_one(doc)

    await m007.up(mock_db)
    first = await collection.find_one({"reading_id": reading_id})
    await m007.up(mock_db)
    second = await collection.find_one({"reading_id": reading_id})

    assert await collection.count_documents({}) == 1
    assert second == first


async def test_006_backfills_every_legacy_reading(mock_db):
    """Several legacy readings at once — every one lands correctly, with no
    cross-talk between them."""
    users = [ObjectId(), ObjectId(), ObjectId()]
    readings = [_legacy_reading(u) for u in users]
    for reading in readings:
        await mock_db[READINGS_COLLECTION].insert_one(reading)

    await m006.up(mock_db)

    assert await mock_db[INTERPRETATIONS_COLLECTION].count_documents({}) == len(readings)
    for reading in readings:
        doc = await mock_db[INTERPRETATIONS_COLLECTION].find_one({"reading_id": reading["_id"]})
        assert doc is not None
        assert doc["user_id"] == reading["user_id"]
        assert doc["settings"] == {"lens": "traditional", "intent": "reflective", "depth": 60}
