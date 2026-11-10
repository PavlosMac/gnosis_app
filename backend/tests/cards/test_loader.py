import json

import pytest

from src.cards.loader import MEANINGS_PATH, load_meanings, read_meanings, upsert_meaning
from src.database.collections.constants import MAJOR_ARCANA_MEANINGS_COLLECTION


def _entry(number: int, name: str, upright: str = "Open air.") -> dict:
    return {
        "number": number,
        "name": name,
        "slug": name.lower().replace(" ", "-"),
        "upright": upright,
        "shadow": "Blind step.",
        "word_count": 4,
        "model": "gpt-test",
        "effort": "medium",
        "generated_at": "2026-11-10T00:00:00Z",
    }


def _write(path, entries: list[dict]) -> None:
    path.write_text(json.dumps({"_meta": {"source": "test"}, "cards": entries}))


def test_read_meanings_returns_the_cards_list(tmp_path):
    path = tmp_path / "m.json"
    _write(path, [_entry(0, "The Fool"), _entry(1, "The Magician")])

    assert [e["number"] for e in read_meanings(path)] == [0, 1]


def test_read_meanings_raises_a_clear_error_when_the_file_is_missing(tmp_path):
    with pytest.raises(FileNotFoundError, match="major_arcana_meanings"):
        read_meanings(tmp_path / "missing.json")


def test_meanings_path_points_into_the_shipped_lib(tmp_path):
    # The loader runs inside the production image, which copies only src/
    assert MEANINGS_PATH.parts[-4:] == ("src", "lib", "cards", "major_arcana_meanings.json")


async def test_upsert_meaning_inserts_then_replaces_by_number(mock_db):
    collection = mock_db[MAJOR_ARCANA_MEANINGS_COLLECTION]

    await upsert_meaning(mock_db, _entry(0, "The Fool", upright="First."))
    await upsert_meaning(mock_db, _entry(0, "The Fool", upright="Second."))

    assert await collection.count_documents({}) == 1
    doc = await collection.find_one({"number": 0})
    assert doc["upright"] == "Second."
    assert doc["updated_at"] is not None


async def test_load_meanings_upserts_every_entry_and_is_idempotent(mock_db, tmp_path):
    path = tmp_path / "m.json"
    _write(path, [_entry(0, "The Fool"), _entry(21, "The World")])

    first = await load_meanings(mock_db, path)
    second = await load_meanings(mock_db, path)

    assert first == second == 2
    collection = mock_db[MAJOR_ARCANA_MEANINGS_COLLECTION]
    assert await collection.count_documents({}) == 2
    assert (await collection.find_one({"number": 21}))["name"] == "The World"


@pytest.mark.parametrize(
    ("entry", "message"),
    [
        ({**_entry(22, "Nope")}, "bad number"),
        ({**_entry(-1, "Nope")}, "bad number"),
        ({**_entry(True, "Nope")}, "bad number"),
        ({**_entry(3, "The Empress"), "upright": ""}, "no upright"),
        ({k: v for k, v in _entry(3, "The Empress").items() if k != "shadow"}, "no shadow"),
    ],
)
def test_read_meanings_rejects_a_malformed_entry(tmp_path, entry, message):
    path = tmp_path / "m.json"
    _write(path, [entry])

    with pytest.raises(ValueError, match=message):
        read_meanings(path)


def test_read_meanings_rejects_a_duplicate_number(tmp_path):
    path = tmp_path / "m.json"
    _write(path, [_entry(0, "The Fool"), _entry(0, "The Fool")])

    with pytest.raises(ValueError, match="twice"):
        read_meanings(path)


def test_the_shipped_file_is_valid_and_complete():
    assert [e["number"] for e in read_meanings()] == list(range(22))
