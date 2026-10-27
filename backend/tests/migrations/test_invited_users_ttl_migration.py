"""Migration 015: the pending-account purge index also covers invited accounts."""

import importlib

import pytest

from src.database.collections.constants import USERS_COLLECTION

m014 = importlib.import_module("src.migrations.versions.014_pending_users_ttl")
m015 = importlib.import_module("src.migrations.versions.015_invited_users_ttl")

EXPECTED_FILTER = {"status": {"$in": ["pending_verification", "invited"]}}


def test_version_matches_filename():
    assert m015.version == "015"


async def _ttl_index(mock_db) -> dict:
    indexes = await mock_db[USERS_COLLECTION].index_information()
    return indexes["pending_users_ttl"]


async def test_015_replaces_014s_partial_filter(mock_db):
    await m014.up(mock_db)
    await m015.up(mock_db)

    ttl = await _ttl_index(mock_db)
    assert ttl["key"] == [("verification_deadline_at", 1)]
    assert ttl["expireAfterSeconds"] == 0
    assert ttl["partialFilterExpression"] == EXPECTED_FILTER


async def test_015_on_a_fresh_db_and_is_idempotent(mock_db):
    await m015.up(mock_db)
    await m015.up(mock_db)

    ttl = await _ttl_index(mock_db)
    assert ttl["partialFilterExpression"] == EXPECTED_FILTER


class _FailingInCreate:
    """A db whose users collection rejects the 015 filter, as a pre-6.0 server would."""

    def __init__(self, db) -> None:
        self._collection = db[USERS_COLLECTION]

    def __getitem__(self, name: str):
        return self

    def __getattr__(self, attr: str):
        return getattr(self._collection, attr)

    async def create_index(self, keys, **kwargs):
        if "$in" in str(kwargs.get("partialFilterExpression")):
            raise RuntimeError("$in is not supported in partialFilterExpression")
        return await self._collection.create_index(keys, **kwargs)


async def test_015_restores_014s_index_when_the_new_one_cannot_be_created(mock_db):
    await m014.up(mock_db)

    with pytest.raises(RuntimeError):
        await m015.up(_FailingInCreate(mock_db))

    ttl = await _ttl_index(mock_db)
    assert ttl["partialFilterExpression"] == {"status": "pending_verification"}
