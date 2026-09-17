"""Migration 010 — the per-user tag vocabulary.

Introduces the user_tags collection (one derived document per user, unique on
user_id) and backfills it from the tags already stored on readings, so users who
tagged readings before the vocabulary existed see them in the picker immediately.
"""

import importlib

from bson import ObjectId

from src.database.collections.constants import READINGS_COLLECTION, USER_TAGS_COLLECTION

m010 = importlib.import_module("src.migrations.versions.010_user_tags")


def _reading(user_id: ObjectId, tags: list[str] | None = None) -> dict:
    doc = {"_id": ObjectId(), "user_id": user_id, "spread_type": "Celtic Cross", "cards": []}
    if tags:
        doc["tags"] = tags
    return doc


async def test_010_backfills_one_document_per_tagged_user(mock_db):
    alice, bob, carol = ObjectId(), ObjectId(), ObjectId()
    await mock_db[READINGS_COLLECTION].insert_many(
        [
            _reading(alice, ["love", "career"]),
            _reading(alice, ["career"]),
            _reading(alice),
            _reading(bob, ["luck"]),
            _reading(carol),
        ]
    )

    await m010.up(mock_db)

    alice_doc = await mock_db[USER_TAGS_COLLECTION].find_one({"user_id": alice})
    assert alice_doc["tags"] == [{"name": "career", "count": 2}, {"name": "love", "count": 1}]
    assert alice_doc["updated_at"] is not None
    bob_doc = await mock_db[USER_TAGS_COLLECTION].find_one({"user_id": bob})
    assert bob_doc["tags"] == [{"name": "luck", "count": 1}]
    assert await mock_db[USER_TAGS_COLLECTION].find_one({"user_id": carol}) is None


async def test_010_creates_unique_user_id_index(mock_db):
    await m010.up(mock_db)

    indexes = await mock_db[USER_TAGS_COLLECTION].index_information()
    unique_on_user_id = [
        spec for spec in indexes.values() if spec["key"] == [("user_id", 1)] and spec.get("unique")
    ]
    assert len(unique_on_user_id) == 1


async def test_010_rerun_is_idempotent(mock_db):
    alice = ObjectId()
    await mock_db[READINGS_COLLECTION].insert_one(_reading(alice, ["career"]))

    await m010.up(mock_db)
    await m010.up(mock_db)

    assert await mock_db[USER_TAGS_COLLECTION].count_documents({}) == 1
    doc = await mock_db[USER_TAGS_COLLECTION].find_one({"user_id": alice})
    assert doc["tags"] == [{"name": "career", "count": 1}]


def test_010_version_matches_filename():
    assert m010.version == "010"
