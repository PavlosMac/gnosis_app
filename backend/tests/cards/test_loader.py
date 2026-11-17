import json

import pytest

from src.cards.loader import (
    MEANINGS_PATH,
    SPREAD_CARDS,
    load_all_meanings,
    load_meanings,
    read_meanings,
    upsert_meaning,
)
from src.database.collections.constants import (
    MAJOR_ARCANA_MEANINGS_COLLECTION,
    SPREAD_CARD_MEANINGS_COLLECTION,
)


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


# --- spread card meanings (the second set, same loader) ---


def _spread_entry(number: int, name: str, meaning: str = "One.\n\nTwo.") -> dict:
    return {
        "number": number,
        "name": name,
        "slug": name.lower().replace(" ", "-"),
        "meaning": meaning,
        "word_count": 2,
        "model": "gpt-test",
        "effort": "medium",
        "generated_at": "2026-11-17T00:00:00Z",
    }


def test_spread_path_points_into_the_shipped_lib():
    assert SPREAD_CARDS.path.parts[-4:] == ("src", "lib", "cards", "spread_card_meanings.json")


async def test_load_spread_meanings_goes_to_its_own_collection(mock_db, tmp_path):
    path = tmp_path / "s.json"
    _write(path, [_spread_entry(0, "The Fool"), _spread_entry(77, "King of Swords")])

    assert await load_meanings(mock_db, path, SPREAD_CARDS) == 2

    assert await mock_db[SPREAD_CARD_MEANINGS_COLLECTION].count_documents({}) == 2
    assert await mock_db[MAJOR_ARCANA_MEANINGS_COLLECTION].count_documents({}) == 0
    doc = await mock_db[SPREAD_CARD_MEANINGS_COLLECTION].find_one({"number": 77})
    assert doc["meaning"] == "One.\n\nTwo."


@pytest.mark.parametrize(
    ("entry", "message"),
    [
        (_spread_entry(78, "Nope"), "spread card meaning has a bad number"),
        ({**_spread_entry(40, "Five of Wands"), "meaning": " "}, "no meaning"),
        # a day-card entry (upright/shadow) is not a spread entry
        (_entry(3, "The Empress"), "no meaning"),
    ],
)
def test_read_spread_meanings_rejects_a_malformed_entry(tmp_path, entry, message):
    path = tmp_path / "s.json"
    _write(path, [entry])

    with pytest.raises(ValueError, match=message):
        read_meanings(path, SPREAD_CARDS)


def test_read_meanings_accepts_number_22_only_for_the_spread_set(tmp_path):
    path = tmp_path / "s.json"
    _write(path, [_spread_entry(22, "Ace of Pentacles")])

    assert len(read_meanings(path, SPREAD_CARDS)) == 1


def test_the_shipped_spread_file_is_valid_and_complete():
    assert [e["number"] for e in read_meanings(spec=SPREAD_CARDS)] == list(range(78))


async def test_load_all_meanings_seeds_both_collections(mock_db):
    counts = await load_all_meanings(mock_db)

    assert counts == {MAJOR_ARCANA_MEANINGS_COLLECTION: 22, SPREAD_CARD_MEANINGS_COLLECTION: 78}
    assert await mock_db[SPREAD_CARD_MEANINGS_COLLECTION].count_documents({}) == 78
