import json

import pytest

from scripts.major_arcana_meanings import FRONTEND_NAMES, select_cards
from scripts.spread_card_meanings import (
    MEANINGS_PATH,
    SYSTEM_PROMPT,
    WORD_CAP,
    deck_cards,
    text_warnings,
    to_entry,
    user_message,
)


def test_deck_cards_covers_all_78_in_frontend_order():
    cards = deck_cards()

    assert [c["number"] for c in cards] == list(range(78))
    assert len({c["name"] for c in cards}) == 78
    assert len({c["slug"] for c in cards}) == 78


def test_deck_cards_starts_with_the_22_major_arcana():
    assert [c["name"] for c in deck_cards()[:22]] == FRONTEND_NAMES


@pytest.mark.parametrize(
    ("number", "name"),
    [
        # frontend/src/lib/cards.ts: SUIT_START = pentacles 22, wands 36, cups 50, swords 64;
        # each suit runs Ace..Ten, Page, Knight, Queen, King.
        (22, "Ace of Pentacles"),
        (26, "Five of Pentacles"),
        (31, "Ten of Pentacles"),
        (32, "Page of Pentacles"),
        (33, "Knight of Pentacles"),
        (34, "Queen of Pentacles"),
        (35, "King of Pentacles"),
        (36, "Ace of Wands"),
        (38, "Three of Wands"),
        (46, "Page of Wands"),
        (49, "King of Wands"),
        (50, "Ace of Cups"),
        (63, "King of Cups"),
        (64, "Ace of Swords"),
        (73, "Ten of Swords"),
        (76, "Queen of Swords"),
        (77, "King of Swords"),
    ],
)
def test_deck_cards_matches_the_frontend_deck_index(number: int, name: str):
    card = deck_cards()[number]

    assert card["number"] == number
    assert card["name"] == name


def test_deck_cards_slugs_are_kebab_case():
    cards = deck_cards()

    assert cards[0]["slug"] == "the-fool"
    assert cards[35]["slug"] == "king-of-pentacles"


def test_select_cards_finds_minors_and_courts_by_name():
    picked = select_cards(deck_cards(), ["queen of swords", "Justice", "Ace of Cups"])

    assert [c["name"] for c in picked] == ["Justice", "Ace of Cups", "Queen of Swords"]


def test_user_message_is_the_card_name_only():
    assert user_message(deck_cards()[11]) == "Card: Justice."


def test_the_prompt_word_limit_matches_the_cap():
    assert f"max {WORD_CAP} words" in SYSTEM_PROMPT


def test_to_entry_normalises_paragraphs_and_counts_words():
    card = deck_cards()[11]

    entry = to_entry(
        card, "  one two\n\n\nthree four five \n", model="gpt-5.4-2026-01-01", effort="medium"
    )

    assert entry["number"] == 11
    assert entry["name"] == "Justice"
    assert entry["slug"] == "justice"
    assert entry["meaning"] == "one two\n\nthree four five"
    assert entry["word_count"] == 5
    assert entry["model"] == "gpt-5.4-2026-01-01"
    assert entry["effort"] == "medium"
    assert entry["generated_at"].endswith("Z")


def test_to_entry_keeps_a_given_timestamp():
    entry = to_entry(deck_cards()[0], "text", "m", "medium", generated_at="2026-11-16T00:00:00Z")

    assert entry["generated_at"] == "2026-11-16T00:00:00Z"


def test_text_warnings_is_empty_for_clean_prose():
    assert text_warnings("Justice centers on truth.\n\nIts shadow lies in coldness.") == []


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("In the Rider Waite tradition, this card", "names a source"),
        ("In the Rider-Waite deck", "names a source"),
        ("**Justice** is a card", "markdown"),
        ("# Justice\n\ntext", "markdown"),
        ("Justice speaks of truth.", "speaks of"),
        ("one paragraph only", "paragraph"),
        ("a\n\nb\n\nc\n\nd", "paragraph"),
        (" ".join(["word"] * (WORD_CAP + 1)) + "\n\nmore", "cap"),
    ],
)
def test_text_warnings_flags_what_the_prompt_forbids(text: str, expected: str):
    assert any(expected in w for w in text_warnings(text))


def test_the_shipped_file_is_valid():
    data = json.loads(MEANINGS_PATH.read_text(encoding="utf-8"))
    by_number = {c["number"]: c for c in deck_cards()}

    numbers = [e["number"] for e in data["cards"]]
    assert numbers == sorted(set(numbers))
    for entry in data["cards"]:
        card = by_number[entry["number"]]
        assert entry["name"] == card["name"]
        assert entry["slug"] == card["slug"]
        assert entry["meaning"].strip()
        assert entry["word_count"] == len(entry["meaning"].split())
        assert text_warnings(entry["meaning"]) == []
