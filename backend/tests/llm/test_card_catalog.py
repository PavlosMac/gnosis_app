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
