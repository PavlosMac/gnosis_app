"""Migrations 013 (verification-token indexes) and 014 (pending-account TTL purge)."""

import importlib

from src.database.collections.constants import (
    EMAIL_VERIFICATION_TOKENS_COLLECTION,
    USERS_COLLECTION,
)

m013 = importlib.import_module("src.migrations.versions.013_email_verification_tokens_indexes")
m014 = importlib.import_module("src.migrations.versions.014_pending_users_ttl")


def test_versions_match_filenames():
    assert m013.version == "013"
    assert m014.version == "014"


async def test_013_creates_token_indexes_and_is_idempotent(mock_db):
    await m013.up(mock_db)
    await m013.up(mock_db)

    indexes = await mock_db[EMAIL_VERIFICATION_TOKENS_COLLECTION].index_information()
    by_key = {tuple(spec["key"][0]): spec for spec in indexes.values()}
    assert by_key[("token_hash", 1)].get("unique") is True
    assert ("user_id", 1) in by_key
    assert by_key[("expires_at", 1)]["expireAfterSeconds"] == 0


async def test_014_creates_the_partial_ttl_index_and_is_idempotent(mock_db):
    await m014.up(mock_db)
    await m014.up(mock_db)

    indexes = await mock_db[USERS_COLLECTION].index_information()
    ttl = indexes["pending_users_ttl"]
    assert ttl["key"] == [("verification_deadline_at", 1)]
    assert ttl["expireAfterSeconds"] == 0
    assert ttl["partialFilterExpression"] == {"status": "pending_verification"}
