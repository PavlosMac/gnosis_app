import json

import pytest

from scripts.major_arcana_meanings import (
    FRONTEND_NAMES,
    MajorArcanaMeaning,
    card_context,
    frontend_identity,
    host_mongo_uri,
    load_source_cards,
    merge_entry,
    select_cards,
    to_entry,
    user_message,
)


def test_frontend_identity_maps_the_fool_to_index_zero():
    assert frontend_identity({"name": "The Fool", "number": 22}) == (0, "The Fool", "the-fool")


def test_frontend_identity_uses_frontend_spellings():
    assert frontend_identity({"name": "Judgment", "number": 20}) == (20, "Judgement", "judgement")
    assert frontend_identity({"name": "Universe", "number": 21}) == (21, "The World", "the-world")
    assert frontend_identity({"name": "The Hierophant", "number": 5}) == (
        5,
        "The Hierophant",
        "the-hierophant",
    )


def test_load_source_cards_covers_all_22_with_frontend_identities():
    cards = load_source_cards()

    assert [c["number"] for c in cards] == list(range(22))
    assert [c["name"] for c in cards] == FRONTEND_NAMES
    assert cards[0]["source"]["number"] == 22  # the Tsarion data is kept as-is


def test_select_cards_by_frontend_name_case_insensitively():
    cards = load_source_cards()

    picked = select_cards(cards, ["the fool", "The World"])

    assert [c["name"] for c in picked] == ["The Fool", "The World"]


def test_select_cards_rejects_unknown_names():
    with pytest.raises(SystemExit, match="Universe"):
        select_cards(load_source_cards(), ["Universe"])


def test_select_cards_without_names_returns_everything():
    cards = load_source_cards()
    assert select_cards(cards, None) == cards


def test_card_context_keeps_the_metadata_and_meaning_lists_only():
    card = load_source_cards()[0]

    context = card_context(card)

    assert set(context) == {"name", "number", "meta", "upright"}
    assert context["name"] == "The Fool"
    assert context["number"] == 22  # the traditional number, matching its numerology block
    assert "keywords" in context["meta"]
    assert "positive" in context["upright"] and "negative" in context["upright"]


def test_user_message_carries_the_keywords_as_json():
    card = load_source_cards()[5]

    message = user_message(card)

    assert "The Hierophant" in message
    assert "keywords" in message
    assert json.loads(message[message.index("{") : message.rindex("}") + 1])["number"] == 5


def test_to_entry_counts_words_across_the_two_paragraphs():
    card = load_source_cards()[0]
    parsed = MajorArcanaMeaning(upright="one two", shadow="three four")

    entry = to_entry(card, parsed, model="gpt-5.4-2026-01-01", effort="medium")

    assert entry["number"] == 0
    assert entry["name"] == "The Fool"
    assert entry["slug"] == "the-fool"
    assert entry["word_count"] == 4
    assert "reversed" not in entry
    assert entry["model"] == "gpt-5.4-2026-01-01"
    assert entry["effort"] == "medium"
    assert entry["generated_at"].endswith("Z")


def test_merge_entry_replaces_the_same_number_and_keeps_number_order():
    entries = [{"number": 5, "upright": "old"}, {"number": 0, "upright": "fool"}]

    merged = merge_entry(entries, {"number": 5, "upright": "new"})

    assert merged == [{"number": 0, "upright": "fool"}, {"number": 5, "upright": "new"}]
    assert entries[0]["upright"] == "old"  # input untouched


def test_host_mongo_uri_rewrites_the_compose_hostname_only():
    assert host_mongo_uri("mongodb://mongodb:27017") == "mongodb://localhost:27017"
    assert host_mongo_uri("mongodb://u:p@mongodb:27017/db") == "mongodb://u:p@localhost:27017/db"
    assert host_mongo_uri("mongodb://localhost:27019") == "mongodb://localhost:27019"
