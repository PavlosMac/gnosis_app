import importlib

from src.database.collections.constants import MAJOR_ARCANA_MEANINGS_COLLECTION

m016 = importlib.import_module("src.migrations.versions.016_major_arcana_meanings")


async def test_016_creates_unique_number_index(mock_db):
    await m016.up(mock_db)

    indexes = await mock_db[MAJOR_ARCANA_MEANINGS_COLLECTION].index_information()
    unique_on_number = [
        spec for spec in indexes.values() if spec["key"] == [("number", 1)] and spec.get("unique")
    ]
    assert len(unique_on_number) == 1


async def test_016_rerun_is_idempotent(mock_db):
    await m016.up(mock_db)
    await m016.up(mock_db)

    indexes = await mock_db[MAJOR_ARCANA_MEANINGS_COLLECTION].index_information()
    assert sum(1 for spec in indexes.values() if spec["key"] == [("number", 1)]) == 1


def test_016_version_matches_filename():
    assert m016.version == "016"

