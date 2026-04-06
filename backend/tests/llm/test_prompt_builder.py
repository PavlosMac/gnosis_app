from src.llm.prompt_builder import build_system_prompt, build_user_prompt
from src.llm.schemas import CardInSpread, InterpretationRequest, Orientation


def _make_request(
    cards: list[CardInSpread],
    question: str = "What lies ahead?",
    spread_name: str = "Past-Present-Future",
) -> InterpretationRequest:
    return InterpretationRequest(spread_name=spread_name, question=question, cards=cards)


def test_system_prompt_is_non_empty():
    prompt = build_system_prompt()
    assert isinstance(prompt, str)
    assert len(prompt) > 0


def test_user_prompt_contains_question():
    req = _make_request(
        [CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright)]
    )
    prompt = build_user_prompt(req)
    assert "What lies ahead?" in prompt


def test_user_prompt_contains_card_name():
    req = _make_request(
        [CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright)]
    )
    prompt = build_user_prompt(req)
    assert "The Fool" in prompt


def test_user_prompt_contains_position():
    req = _make_request(
        [CardInSpread(name="Ace of Wands", position="Present", orientation=Orientation.upright)]
    )
    prompt = build_user_prompt(req)
    assert "Present" in prompt


def test_major_arcana_upright_shows_upright_fields():
    req = _make_request(
        [CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright)]
    )
    prompt = build_user_prompt(req)
    assert "Upright" in prompt
    assert "upright" in prompt.lower()


def test_major_arcana_reversed_shows_reversed_fields_only():
    req = _make_request(
        [CardInSpread(name="The Fool", position="Past", orientation=Orientation.reversed)]
    )
    prompt = build_user_prompt(req)
    assert "Reversed" in prompt
    # Must not show upright label when reversed
    assert "Upright —" not in prompt


def test_minor_arcana_upright_shows_upright_fields():
    req = _make_request(
        [CardInSpread(name="Ace of Wands", position="Present", orientation=Orientation.upright)]
    )
    prompt = build_user_prompt(req)
    assert "Upright" in prompt


def test_minor_arcana_reversed_shows_reversed_fields_only():
    req = _make_request(
        [CardInSpread(name="Ace of Wands", position="Present", orientation=Orientation.reversed)]
    )
    prompt = build_user_prompt(req)
    assert "Reversed" in prompt
    assert "Upright —" not in prompt


def test_court_card_includes_meta():
    req = _make_request(
        [CardInSpread(name="Knight of Wands", position="Future", orientation=Orientation.upright)]
    )
    prompt = build_user_prompt(req)
    assert "Kabbalah" in prompt or "Elemental" in prompt


def test_three_card_spread():
    req = _make_request(
        [
            CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright),
            CardInSpread(name="Ace of Cups", position="Present", orientation=Orientation.reversed),
            CardInSpread(name="The World", position="Future", orientation=Orientation.upright),
        ]
    )
    prompt = build_user_prompt(req)
    print(prompt)
    assert "The Fool" in prompt
    assert "Ace of Cups" in prompt
    assert "The World" in prompt
    assert "Past" in prompt
    assert "Present" in prompt
    assert "Future" in prompt
