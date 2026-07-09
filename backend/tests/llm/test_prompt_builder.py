from src.llm.prompt_builder import (
    _distinct_card_count,
    _synthesis_target_words,
    build_system_prompt,
    build_user_prompt,
)
from src.llm.schemas import (
    DEFAULT_SETTINGS,
    CardInSpread,
    InterpretationRequest,
    InterpretationSettings,
    Orientation,
    ReadingStyle,
)


def _make_request(
    cards: list[CardInSpread],
    question: str | None = "What lies ahead?",
    spread_name: str = "Past-Present-Future",
    settings: InterpretationSettings = DEFAULT_SETTINGS,
    context: str | None = None,
) -> InterpretationRequest:
    return InterpretationRequest(
        spread_name=spread_name,
        question=question,
        cards=cards,
        settings=settings,
        context=context,
    )


def _make_system_request(
    spread_name: str = "Past-Present-Future",
    settings: InterpretationSettings = DEFAULT_SETTINGS,
) -> InterpretationRequest:
    return _make_request(
        [CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright)],
        spread_name=spread_name,
        settings=settings,
    )


def test_system_prompt_is_non_empty():
    prompt = build_system_prompt(_make_system_request())
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


# --- Significators spread ---


def _make_significators_request() -> InterpretationRequest:
    return _make_request(
        cards=[
            CardInSpread(
                name="The Hierophant",
                position="day number",
                orientation=Orientation.upright,
                position_description="Your day number is 5, representing the day you were born.",
            ),
            CardInSpread(
                name="The Empress",
                position="life number 1",
                orientation=Orientation.upright,
                position_description="Your life number is 12. These cards share the same "
                "numerological attributes.",
            ),
            CardInSpread(
                name="Strength",
                position="star sign",
                orientation=Orientation.upright,
                position_description="Your sun sign is Leo, connected to this Major Arcana.",
            ),
        ],
        question=None,
        spread_name="Significators",
    )


def test_system_prompt_significators_returns_chart_prompt():
    prompt = build_system_prompt(_make_system_request("Significators"))
    default = build_system_prompt(_make_system_request())
    assert prompt != default
    assert "significator chart" in prompt.lower()


def test_system_prompt_significators_no_reversed_guidance():
    prompt = build_system_prompt(_make_system_request("Significators"))
    assert "Reversed cards" not in prompt
    assert "shadow energy" not in prompt


def test_system_prompt_significators_character_focus():
    prompt = build_system_prompt(_make_system_request("Significators"))
    assert "character" in prompt.lower()
    assert "personality" in prompt.lower()
    assert "life themes" in prompt.lower()


def test_system_prompt_significators_life_number_guidance():
    prompt = build_system_prompt(_make_system_request("Significators"))
    assert "life number" in prompt.lower() or "Life number" in prompt


def test_user_prompt_significators_no_question():
    req = _make_significators_request()
    prompt = build_user_prompt(req)
    assert "general reading" not in prompt.lower()
    assert "significator chart" in prompt.lower()


def test_system_prompt_unknown_spread_returns_default():
    default = build_system_prompt(_make_system_request())
    assert build_system_prompt(_make_system_request("Unknown Spread")) == default
    assert build_system_prompt(_make_system_request("Celtic Cross")) == default


# --- Style weights ---


def test_system_prompt_includes_default_style_weights():
    prompt = build_system_prompt(_make_system_request())
    assert "READING STYLE:" in prompt
    assert "Esoteric (Kabbalah, alchemy, mythology): 0.2" in prompt


def test_system_prompt_esoteric_style_uses_esoteric_weights():
    esoteric = InterpretationSettings(style=ReadingStyle.esoteric, depth=60, tone=50)
    prompt = build_system_prompt(_make_system_request(settings=esoteric))
    assert "Esoteric (Kabbalah, alchemy, mythology): 1.0" in prompt
    assert "Literal card meanings (upright/reversed meanings, keywords): 0.3" in prompt


def test_system_prompt_style_applies_to_significators_too():
    practical = InterpretationSettings(style=ReadingStyle.practical, depth=60, tone=50)
    prompt = build_system_prompt(_make_system_request("Significators", settings=practical))
    assert "significator chart" in prompt.lower()
    assert "Esoteric (Kabbalah, alchemy, mythology): 0.0" in prompt


# --- Synthesis length scaling ---


def test_synthesis_target_is_flat_through_three_distinct_cards():
    assert _synthesis_target_words(1) == 170
    assert _synthesis_target_words(2) == 170
    assert _synthesis_target_words(3) == 170


def test_synthesis_target_grows_sixty_words_per_card_after_three():
    assert _synthesis_target_words(4) == 230
    assert _synthesis_target_words(5) == 290
    assert _synthesis_target_words(10) == 590


def _repeated_card_request(spread_name: str) -> InterpretationRequest:
    cards = [
        CardInSpread(name="The Moon", position="day number", orientation=Orientation.upright),
        CardInSpread(name="The Moon", position="star sign", orientation=Orientation.upright),
        CardInSpread(name="Justice", position="life number 1", orientation=Orientation.upright),
    ]
    return InterpretationRequest(spread_name=spread_name, question=None, cards=cards)


def test_distinct_count_dedupes_repeated_cards_for_significators():
    req = _repeated_card_request("Significators")
    assert _distinct_card_count(req) == 2


def test_distinct_count_does_not_dedupe_for_other_spreads():
    req = _repeated_card_request("Celtic Cross")
    assert _distinct_card_count(req) == 3


def test_user_prompt_includes_synthesis_length_line():
    req = _make_request(
        [CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright)]
    )
    prompt = build_user_prompt(req)
    assert "Synthesis length: aim for roughly 170 words." in prompt


# --- Depth, tone and context ---


def _one_card_request(settings: InterpretationSettings) -> InterpretationRequest:
    return _make_request(
        [CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright)],
        settings=settings,
    )


def test_user_prompt_default_depth_is_detailed_and_keeps_synthesis_target():
    prompt = build_user_prompt(_one_card_request(DEFAULT_SETTINGS))
    assert "Depth: detailed" in prompt
    assert "Synthesis length: aim for roughly 170 words." in prompt


def test_user_prompt_brief_depth_halves_synthesis_target():
    settings = InterpretationSettings(style=ReadingStyle.reflective, depth=10, tone=50)
    prompt = build_user_prompt(_one_card_request(settings))
    assert "Depth: brief" in prompt
    assert "Synthesis length: aim for roughly 85 words." in prompt


def test_user_prompt_comprehensive_depth_grows_synthesis_target():
    settings = InterpretationSettings(style=ReadingStyle.reflective, depth=90, tone=50)
    prompt = build_user_prompt(_one_card_request(settings))
    assert "Depth: comprehensive" in prompt
    assert "Synthesis length: aim for roughly 255 words." in prompt


def test_user_prompt_tone_bands():
    gentle = InterpretationSettings(style=ReadingStyle.reflective, depth=60, tone=10)
    balanced = InterpretationSettings(style=ReadingStyle.reflective, depth=60, tone=50)
    direct = InterpretationSettings(style=ReadingStyle.reflective, depth=60, tone=80)
    assert "Tone: gentle" in build_user_prompt(_one_card_request(gentle))
    assert "Tone: balanced" in build_user_prompt(_one_card_request(balanced))
    assert "Tone: direct" in build_user_prompt(_one_card_request(direct))


def test_user_prompt_includes_context_line_when_set():
    req = _make_request(
        [CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright)],
        context="recently divorced",
    )
    prompt = build_user_prompt(req)
    assert "Additional context from the querent: recently divorced" in prompt


def test_user_prompt_omits_context_line_by_default():
    req = _make_request(
        [CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright)]
    )
    prompt = build_user_prompt(req)
    assert "Additional context" not in prompt
