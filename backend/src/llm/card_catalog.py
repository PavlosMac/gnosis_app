"""Card catalog — loads all tarot card data from JSON files at import time.

Files are small, static, and always needed, so eager module-level loading is appropriate.
"""

import json
from pathlib import Path
from typing import Any

_CARDS_DIR = Path(__file__).parent.parent / "lib" / "cards"


def _load_json(filename: str) -> Any:
    with (_CARDS_DIR / filename).open(encoding="utf-8") as f:
        return json.load(f)


def _load_cards() -> tuple[
    dict[str, dict[str, Any]],
    dict[str, dict[str, Any]],
    set[str],
    dict[str, dict[str, Any]],
    dict[str, str],
]:
    """Return (major, minor_and_court, court_names, suits, card_suit_map)."""
    major_raw = _load_json("major_arcana.json")
    minor_raw = _load_json("minor_arcana.json")
    court_raw = _load_json("court_royals.json")
    suits_raw = _load_json("suits.json")

    major: dict[str, dict[str, Any]] = {c["name"]: c for c in major_raw["major_arcana"]}

    minor_and_court: dict[str, dict[str, Any]] = {}
    court_names: set[str] = set()
    card_suit_map: dict[str, str] = {}

    for suit_name, cards in minor_raw["suits"].items():
        for card in cards:
            minor_and_court[card["name"]] = card
            card_suit_map[card["name"]] = suit_name

    for suit_name, cards in court_raw["suits"].items():
        for card in cards:
            minor_and_court[card["name"]] = card
            court_names.add(card["name"])
            card_suit_map[card["name"]] = suit_name

    suits: dict[str, dict[str, Any]] = suits_raw["suits"]

    return major, minor_and_court, court_names, suits, card_suit_map


_major, _minor_and_court, _court_names, _suits, _card_suit_map = _load_cards()


def get_card_meaning(name: str) -> dict[str, Any] | None:
    return _major.get(name) or _minor_and_court.get(name)


def get_suit_info(name: str) -> dict[str, Any] | None:
    suit_name = _card_suit_map.get(name)
    if suit_name is None:
        return None
    return _suits.get(suit_name)


def is_major_arcana(name: str) -> bool:
    return name in _major


def is_court_card(name: str) -> bool:
    return name in _court_names


def get_all_card_names() -> list[str]:
    return list(_major) + list(_minor_and_court)
