from src.llm import card_catalog


def test_all_78_cards_load():
    names = card_catalog.get_all_card_names()
    assert len(names) == 78


def test_major_arcana_count():
    major = [n for n in card_catalog.get_all_card_names() if card_catalog.is_major_arcana(n)]
    assert len(major) == 22


def test_minor_and_court_count():
    non_major = [
        n for n in card_catalog.get_all_card_names() if not card_catalog.is_major_arcana(n)
    ]
    assert len(non_major) == 56  # 40 pip + 16 court


def test_court_card_count():
    court = [n for n in card_catalog.get_all_card_names() if card_catalog.is_court_card(n)]
    assert len(court) == 16


def test_lookup_major_arcana_card():
    card = card_catalog.get_card_meaning("The Fool")
    assert card is not None
    assert card["name"] == "The Fool"
    assert isinstance(card["upright"]["positive"], list)
    assert isinstance(card["upright"]["negative"], list)


def test_lookup_minor_arcana_card():
    card = card_catalog.get_card_meaning("Ace of Wands")
    assert card is not None
    assert card["name"] == "Ace of Wands"
    assert isinstance(card["upright"], list)
    assert isinstance(card["reversed"], list)


def test_lookup_court_card():
    card = card_catalog.get_card_meaning("Knight of Wands")
    assert card is not None
    assert isinstance(card["upright"], list)
    assert "meta" in card


def test_unknown_card_returns_none():
    assert card_catalog.get_card_meaning("The Banana") is None


def test_is_major_arcana_true():
    assert card_catalog.is_major_arcana("The Magician") is True


def test_is_major_arcana_false_for_minor():
    assert card_catalog.is_major_arcana("Ace of Cups") is False


def test_is_court_card_true():
    assert card_catalog.is_court_card("Queen of Wands") is True


def test_is_court_card_false_for_pip():
    assert card_catalog.is_court_card("Five of Swords") is False


def test_get_suit_info_minor():
    suit = card_catalog.get_suit_info("Ace of Wands")
    assert suit is not None
    assert suit["element"] == "Fire"


def test_get_suit_info_court():
    suit = card_catalog.get_suit_info("Knight of Cups")
    assert suit is not None
    assert suit["element"] == "Water"


def test_get_suit_info_major_returns_none():
    assert card_catalog.get_suit_info("The Tower") is None


# --- Pip attributions (Golden Dawn Book T) ---

_WORLDS = {"wands": "Atziluth", "cups": "Briah", "swords": "Yetzirah", "disks": "Assiah"}
_SEPHIROTH = {
    1: "Kether",
    2: "Chokmah",
    3: "Binah",
    4: "Chesed",
    5: "Geburah",
    6: "Tiphareth",
    7: "Netzach",
    8: "Hod",
    9: "Yesod",
    10: "Malkuth",
}


def _pips() -> list[dict]:
    return [
        card
        for name in card_catalog.get_all_card_names()
        if not card_catalog.is_major_arcana(name) and not card_catalog.is_court_card(name)
        if (card := card_catalog.get_card_meaning(name)) is not None
    ]


def test_every_pip_has_meta():
    pips = _pips()
    assert len(pips) == 40
    for card in pips:
        meta = card["meta"]
        assert meta["title"]
        assert meta["numerology"]["number"] == card["number"]
        assert meta["numerology"]["meaning"]
        assert meta["esoteric"]["kabbalah"].endswith(_WORLDS[card["suit"]])


def test_pip_sephira_matches_number():
    for card in _pips():
        assert card["meta"]["esoteric"]["kabbalah"].startswith(_SEPHIROTH[card["number"]])


def test_aces_have_no_astrology():
    for card in _pips():
        if card["number"] == 1:
            assert "astrology" not in card["meta"]
            assert card["meta"]["title"].startswith("Root of the Powers of")


def test_pip_decans_cover_the_zodiac_once():
    decans = [card["meta"]["astrology"]["decan"] for card in _pips() if card["number"] != 1]
    assert len(decans) == 36
    assert len(set(decans)) == 36
    signs = [card["meta"]["astrology"]["sign"] for card in _pips() if card["number"] != 1]
    assert len(set(signs)) == 12
    for sign in set(signs):
        assert signs.count(sign) == 3


def test_pip_lookup_includes_meta():
    card = card_catalog.get_card_meaning("Five of Disks")
    assert card is not None
    assert card["meta"]["astrology"]["planet"] == ["Mercury"]
    assert card["meta"]["astrology"]["sign"] == "Taurus"
    assert card["meta"]["esoteric"]["kabbalah"] == "Geburah in Assiah"
