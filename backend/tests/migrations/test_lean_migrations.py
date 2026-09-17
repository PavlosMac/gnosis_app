"""Migrations 008 and 009 — the lean-prompt data model.

008 goes straight from the legacy shape to the final one: collapses the per-card
interpretation shape into one narrative, drops settings entirely, keeps only the
newest interpretation per reading, and re-keys the unique slot index from
(reading_id, settings.lens) to reading_id alone. (An interim split that paused at a
per-intent slot model never shipped — no database needs to stop there.) 009 retires
the legacy total_tokens_used counter on users, superseded by the usage aggregate the
budget gate maintains.
"""

import importlib
from datetime import UTC, datetime

from bson import ObjectId

from src.database.collections.constants import INTERPRETATIONS_COLLECTION, USERS_COLLECTION

m008 = importlib.import_module("src.migrations.versions.008_lean_interpretations")
m009 = importlib.import_module("src.migrations.versions.009_user_usage_accounting")


def _legacy_doc(
    reading_id: ObjectId,
    lens: str = "traditional",
    updated_at: datetime | None = None,
) -> dict:
    return {
        "_id": ObjectId(),
        "reading_id": reading_id,
        "user_id": ObjectId(),
        "card_interpretations": [
            {
                "card_name": "The Fool",
                "position": "Present",
                "orientation": "upright",
                "interpretation": f"New beginnings ({lens}).",
            },
            {
                "card_name": "The World",
                "position": "Future",
                "orientation": "upright",
                "interpretation": "Completion.",
            },
        ],
        "synthesis": "A journey begins and ends.",
        "tokens_used": 1234,
        "model": "gpt-4o",
        "settings": {"lens": lens, "intent": "reflective", "depth": 60},
        "created_at": datetime(2026, 1, 1, tzinfo=UTC),
        "updated_at": updated_at or datetime(2026, 1, 1, tzinfo=UTC),
    }


async def test_008_collapses_per_card_shape_into_one_narrative(mock_db):
    collection = mock_db[INTERPRETATIONS_COLLECTION]
    reading_id = ObjectId()
    await collection.insert_one(_legacy_doc(reading_id))

    await m008.up(mock_db)

    doc = await collection.find_one({"reading_id": reading_id})
    assert doc["reading"] == (
        "New beginnings (traditional).\n\nCompletion.\n\nA journey begins and ends."
    )
    assert "settings" not in doc
    assert "card_interpretations" not in doc
    assert "synthesis" not in doc
    assert "tokens_used" not in doc
    # The prose survives; the model label survives; there is no fabricated usage ledger.
    assert doc["model"] == "gpt-4o"
    assert "usage" not in doc


async def test_008_keeps_only_the_newest_interpretation_per_reading(mock_db):
    """Matches production shape: the old (reading_id, settings.lens) unique index is
    live while several lens slots exist per reading. 008 must drop that index BEFORE
    transforming — stripping settings on the second slot of a reading would otherwise
    raise E11000 mid-migration. The new key is reading_id alone, so all of a reading's
    slots collapse onto one document: the newest. (mongomock does not enforce unique
    indexes on updates, so this test pins the outcome; the ordering constraint itself
    is documented in the migration.)"""
    collection = mock_db[INTERPRETATIONS_COLLECTION]
    await collection.create_index([("reading_id", 1), ("settings.lens", 1)], unique=True)
    multi_slot_reading = ObjectId()
    single_slot_reading = ObjectId()
    older = _legacy_doc(multi_slot_reading, lens="traditional", updated_at=datetime(2026, 1, 1))
    newest = _legacy_doc(multi_slot_reading, lens="esoteric", updated_at=datetime(2026, 6, 1))
    middle = _legacy_doc(multi_slot_reading, lens="alchemical", updated_at=datetime(2026, 3, 1))
    untouched = _legacy_doc(single_slot_reading)
    for doc in (older, newest, middle, untouched):
        await collection.insert_one(doc)

    await m008.up(mock_db)

    kept = await collection.find({"reading_id": multi_slot_reading}).to_list(length=10)
    assert len(kept) == 1
    assert kept[0]["_id"] == newest["_id"]
    assert "esoteric" in kept[0]["reading"]
    assert await collection.count_documents({"reading_id": single_slot_reading}) == 1


async def test_008_rekeys_the_unique_index_straight_to_reading_id(mock_db):
    collection = mock_db[INTERPRETATIONS_COLLECTION]
    await collection.create_index([("reading_id", 1), ("settings.lens", 1)], unique=True)

    await m008.up(mock_db)

    indexes = await collection.index_information()
    keys = [[field for field, _ in info["key"]] for info in indexes.values()]
    assert ["reading_id", "settings.lens"] not in keys
    assert ["reading_id", "settings.intent"] not in keys
    reading_id_index = next(
        info for info in indexes.values() if [f for f, _ in info["key"]] == ["reading_id"]
    )
    assert reading_id_index.get("unique") is True


async def test_008_drops_the_interim_intent_index_from_a_half_migrated_database(mock_db):
    """A dev database that ran the interim split of this migration carries a
    (reading_id, settings.intent) unique index instead of the lens one — 008 must
    drop that too, so re-running it (after clearing its _migrations row) self-heals."""
    collection = mock_db[INTERPRETATIONS_COLLECTION]
    await collection.create_index([("reading_id", 1), ("settings.intent", 1)], unique=True)

    await m008.up(mock_db)

    indexes = await collection.index_information()
    keys = [[field for field, _ in info["key"]] for info in indexes.values()]
    assert ["reading_id", "settings.intent"] not in keys
    assert ["reading_id"] in keys


async def test_008_removes_settings_from_every_document(mock_db):
    """Also the already-narrative docs: settings held only prompt knobs (lens, depth,
    intent) the lean model no longer has."""
    collection = mock_db[INTERPRETATIONS_COLLECTION]
    narrative_with_settings = {
        "_id": ObjectId(),
        "reading_id": ObjectId(),
        "user_id": ObjectId(),
        "reading": "A woven narrative.",
        "model": "mock",
        "settings": {"intent": "predictive"},
        "created_at": datetime(2026, 8, 1, tzinfo=UTC),
        "updated_at": datetime(2026, 8, 1, tzinfo=UTC),
    }
    await collection.insert_many([_legacy_doc(ObjectId()), narrative_with_settings])

    await m008.up(mock_db)

    assert await collection.count_documents({"settings": {"$exists": True}}) == 0


async def test_008_is_idempotent(mock_db):
    collection = mock_db[INTERPRETATIONS_COLLECTION]
    reading_id = ObjectId()
    await collection.insert_many(
        [
            _legacy_doc(reading_id, lens="traditional", updated_at=datetime(2026, 1, 1)),
            _legacy_doc(reading_id, lens="esoteric", updated_at=datetime(2026, 6, 1)),
        ]
    )

    await m008.up(mock_db)
    first_pass = await collection.find({}).to_list(None)
    await m008.up(mock_db)
    second_pass = await collection.find({}).to_list(None)

    assert first_pass == second_pass
    assert len(second_pass) == 1
    assert "esoteric" in second_pass[0]["reading"]


async def test_008_leaves_already_final_documents_alone(mock_db):
    collection = mock_db[INTERPRETATIONS_COLLECTION]
    final = {
        "_id": ObjectId(),
        "reading_id": ObjectId(),
        "user_id": ObjectId(),
        "reading": "A woven narrative.",
        "model": "gpt-5.4-2026-01-01",
        "usage": {
            "prompt_tokens": 480,
            "completion_tokens": 723,
            "reasoning_tokens": 329,
            "model": "gpt-5.4-2026-01-01",
            "cost_usd": 0.012,
        },
        "created_at": datetime(2026, 8, 1, tzinfo=UTC),
        "updated_at": datetime(2026, 8, 1, tzinfo=UTC),
    }
    await collection.insert_one(dict(final))

    await m008.up(mock_db)

    doc = await collection.find_one({"_id": final["_id"]})
    doc.pop("created_at")
    doc.pop("updated_at")
    for key, value in doc.items():
        assert final[key] == value


async def test_009_unsets_the_legacy_token_counter(mock_db):
    users = mock_db[USERS_COLLECTION]
    await users.insert_one({"_id": ObjectId(), "email": "a@example.com", "total_tokens_used": 42})
    await users.insert_one({"_id": ObjectId(), "email": "b@example.com"})

    await m009.up(mock_db)
    await m009.up(mock_db)  # idempotent

    assert await users.count_documents({"total_tokens_used": {"$exists": True}}) == 0
    assert await users.count_documents({}) == 2
