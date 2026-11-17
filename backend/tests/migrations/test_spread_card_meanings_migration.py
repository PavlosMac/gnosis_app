import importlib

from src.database.collections.constants import SPREAD_CARD_MEANINGS_COLLECTION

m017 = importlib.import_module("src.migrations.versions.017_spread_card_meanings")


async def test_017_creates_unique_number_index(mock_db):
    await m017.up(mock_db)

    indexes = await mock_db[SPREAD_CARD_MEANINGS_COLLECTION].index_information()
    unique_on_number = [
        spec for spec in indexes.values() if spec["key"] == [("number", 1)] and spec.get("unique")
    ]
    assert len(unique_on_number) == 1


async def test_017_rerun_is_idempotent(mock_db):
    await m017.up(mock_db)
    await m017.up(mock_db)

    indexes = await mock_db[SPREAD_CARD_MEANINGS_COLLECTION].index_information()
    assert sum(1 for spec in indexes.values() if spec["key"] == [("number", 1)]) == 1


def test_017_version_matches_filename():
    assert m017.version == "017"
