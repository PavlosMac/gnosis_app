"""Migration 012 — the tag-filter + date-sort index on readings.

A tag-filtered list with an explicit date sort was picking 003's (user_id, tags)
index and sorting in memory. (user_id, tags, created_at desc) serves the filter and
the sort together (one tag: a plain index scan; several: a sort-merge of one scan
per tag), and (user_id, tags) becomes a prefix of it, so 012 retires that one.
"""

import importlib

from src.database.collections.constants import READINGS_COLLECTION

m012 = importlib.import_module("src.migrations.versions.012_reading_tags_date_index")

TAGS_DATE_KEY = [("user_id", 1), ("tags", 1), ("created_at", -1)]
LEGACY_TAGS_KEY = [("user_id", 1), ("tags", 1)]


async def _keys(mock_db) -> list[list[tuple[str, int]]]:
    indexes = await mock_db[READINGS_COLLECTION].index_information()
    return [spec["key"] for spec in indexes.values()]


async def test_012_creates_the_tags_date_index(mock_db):
    await m012.up(mock_db)

    assert (await _keys(mock_db)).count(TAGS_DATE_KEY) == 1


async def test_012_drops_the_legacy_tags_prefix_index(mock_db):
    await mock_db[READINGS_COLLECTION].create_index(LEGACY_TAGS_KEY)

    await m012.up(mock_db)

    keys = await _keys(mock_db)
    assert LEGACY_TAGS_KEY not in keys
    assert TAGS_DATE_KEY in keys


async def test_012_is_idempotent(mock_db):
    await m012.up(mock_db)
    await m012.up(mock_db)

    assert (await _keys(mock_db)).count(TAGS_DATE_KEY) == 1


def test_012_version_matches_filename():
    assert m012.version == "012"
