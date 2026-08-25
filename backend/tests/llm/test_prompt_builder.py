import pytest

from src.llm.prompt_builder import (
    REASONING_HEADROOM,
    _distinct_card_count,
    build_system_prompt,
    build_user_prompt,
    max_completion_tokens,
    request_word_budget,
    word_budget,
)
from src.llm.prompt_components import LENS_SYNTHESIS
from src.llm.schemas import (
    CardInSpread,
    InterpretationLens,
    InterpretationRequest,
    InterpretationSettings,
    Orientation,
    ReadingIntent,
)
from tests.factories import DEFAULT_SETTINGS as _DEFAULT
from tests.factories import make_settings as _settings


def _make_request(
    cards: list[CardInSpread],
    question: str | None = "What lies ahead?",
    spread_name: str = "Past-Present-Future",
    settings: InterpretationSettings = _DEFAULT,
) -> InterpretationRequest:
    return InterpretationRequest(
        spread_name=spread_name,
        question=question,
        cards=cards,
        settings=settings,
    )


def _make_system_request(
    spread_name: str = "Past-Present-Future",
    settings: InterpretationSettings = _DEFAULT,
) -> InterpretationRequest:
    return _make_request(
        [CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright)],
        spread_name=spread_name,
        settings=settings,
    )


def _system_prompt(request: InterpretationRequest) -> str:
    return build_system_prompt(request)


def _user_prompt(request: InterpretationRequest, meanings: dict | None = None) -> str:
    return build_user_prompt(request, meanings)


def test_system_prompt_is_non_empty():
    prompt = _system_prompt(_make_system_request())
    assert isinstance(prompt, str)
    assert len(prompt) > 0


def test_user_prompt_contains_question():
    req = _make_request(
        [CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright)]
    )
    prompt = _user_prompt(req)
    assert "What lies ahead?" in prompt


def test_user_prompt_contains_card_name():
    req = _make_request(
        [CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright)]
    )
    prompt = _user_prompt(req)
    assert "The Fool" in prompt


def test_user_prompt_contains_position():
    req = _make_request(
        [CardInSpread(name="Ace of Wands", position="Present", orientation=Orientation.upright)]
    )
    prompt = _user_prompt(req)
    assert "Present" in prompt


def test_major_arcana_upright_shows_upright_fields():
    req = _make_request(
        [CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright)]
    )
    prompt = _user_prompt(req)
    assert "Upright" in prompt
    assert "upright" in prompt.lower()


def test_major_arcana_reversed_shows_reversed_fields_only():
    req = _make_request(
        [CardInSpread(name="The Fool", position="Past", orientation=Orientation.reversed)]
    )
    prompt = _user_prompt(req)
    assert "Reversed" in prompt
    # Must not show upright label when reversed
    assert "Upright —" not in prompt


def test_minor_arcana_upright_shows_upright_fields():
    req = _make_request(
        [CardInSpread(name="Ace of Wands", position="Present", orientation=Orientation.upright)]
    )
    prompt = _user_prompt(req)
    assert "Upright" in prompt


def test_minor_arcana_reversed_shows_reversed_fields_only():
    req = _make_request(
        [CardInSpread(name="Ace of Wands", position="Present", orientation=Orientation.reversed)]
    )
    prompt = _user_prompt(req)
    assert "Reversed" in prompt
    assert "Upright —" not in prompt


def test_court_card_includes_meta():
    req = _make_request(
        [CardInSpread(name="Knight of Wands", position="Future", orientation=Orientation.upright)]
    )
    prompt = _user_prompt(req)
    assert "Kabbalah" in prompt or "Elemental" in prompt


def test_three_card_spread():
    req = _make_request(
        [
            CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright),
            CardInSpread(name="Ace of Cups", position="Present", orientation=Orientation.reversed),
            CardInSpread(name="The World", position="Future", orientation=Orientation.upright),
        ]
    )
    prompt = _user_prompt(req)
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
    prompt = _system_prompt(_make_system_request("Significators"))
    default = _system_prompt(_make_system_request())
    assert prompt != default
    assert "significator chart" in prompt.lower()


def test_system_prompt_significators_no_reversed_guidance():
    prompt = _system_prompt(_make_system_request("Significators"))
    assert "Reversed cards" not in prompt
    assert "shadow energy" not in prompt


def test_system_prompt_significators_character_focus():
    prompt = _system_prompt(_make_system_request("Significators"))
    assert "character" in prompt.lower()
    assert "personality" in prompt.lower()
    assert "life themes" in prompt.lower()


def test_system_prompt_significators_life_number_guidance():
    prompt = _system_prompt(_make_system_request("Significators"))
    assert "life number" in prompt.lower() or "Life number" in prompt


def test_user_prompt_significators_no_question():
    req = _make_significators_request()
    prompt = _user_prompt(req)
    assert "general reading" not in prompt.lower()
    assert "significator chart" in prompt.lower()


def test_system_prompt_unknown_spread_returns_default():
    default = _system_prompt(_make_system_request())
    assert _system_prompt(_make_system_request("Unknown Spread")) == default
    assert _system_prompt(_make_system_request("Celtic Cross")) == default


# --- Lens blocks ---


def test_every_lens_emits_its_own_block():
    seen = set()
    for lens in InterpretationLens:
        prompt = _system_prompt(_make_system_request(settings=_settings(lens=lens)))
        assert f"LENS: {lens.value.capitalize()}." in prompt
        seen.add(prompt)
    # Four distinct lenses must produce four distinct prompts, or a lens is decoration.
    assert len(seen) == len(InterpretationLens)


def test_lens_applies_to_significators_too():
    prompt = _system_prompt(
        _make_system_request("Significators", settings=_settings(lens=InterpretationLens.esoteric))
    )
    assert "significator chart" in prompt.lower()
    assert "LENS: Esoteric." in prompt


def test_old_style_weighting_is_gone():
    prompt = _system_prompt(_make_system_request())
    assert "READING STYLE:" not in prompt
    assert "Esoteric (Kabbalah, alchemy, mythology)" not in prompt
    assert "Tone:" not in prompt


# --- Intent blocks ---


def test_every_intent_emits_its_own_block():
    for intent in ReadingIntent:
        prompt = _system_prompt(_make_system_request(settings=_settings(intent=intent)))
        assert f"INTENT: {intent.value.capitalize()}." in prompt


def test_reflective_forbids_forecasting_and_predictive_requires_it():
    reflective = _system_prompt(
        _make_system_request(settings=_settings(intent=ReadingIntent.reflective))
    )
    predictive = _system_prompt(
        _make_system_request(settings=_settings(intent=ReadingIntent.predictive))
    )
    assert "Do not forecast events." in reflective
    assert "Name likely developments" in predictive


# --- Block order ---


def test_blocks_compose_in_constraint_order():
    """Later text carries more weight, so the narrowest instruction goes last."""
    prompt = _system_prompt(_make_system_request())
    order = [
        prompt.index("CARD TYPES."),
        prompt.index("ORIENTATION."),
        prompt.index("POSITION."),
        prompt.index("LENS: Traditional."),
        prompt.index("INTENT: Reflective."),
        prompt.index("SYNTHESIS."),
        prompt.index("OUTPUT."),
    ]
    assert order == sorted(order)


def test_observer_block_is_off_by_default():
    prompt = _system_prompt(_make_system_request())
    assert "not a party to this situation" not in prompt


def test_significators_omits_orientation_block():
    prompt = _system_prompt(_make_system_request("Significators"))
    assert "ORIENTATION." not in prompt
    assert "ORIENTATION." in _system_prompt(_make_system_request())


def test_significators_omits_position_block():
    """BASE_SIGNIFICATORS already explains its own four positions."""
    prompt = _system_prompt(_make_system_request("Significators"))
    assert "POSITION." not in prompt
    assert "POSITION." in _system_prompt(_make_system_request())


def test_position_block_present_for_standard_spreads():
    prompt = _system_prompt(_make_system_request())
    assert "let it shape the reading" in prompt


def test_significators_omits_intent_block_for_every_intent():
    """A fixed character chart has no predictive/reflective axis — INTENT never
    appears for Significators, no matter which intent is requested."""
    for intent in ReadingIntent:
        prompt = _system_prompt(
            _make_system_request("Significators", settings=_settings(intent=intent))
        )
        assert "INTENT:" not in prompt
    assert "INTENT:" in _system_prompt(_make_system_request())


# --- Synthesis block ---


def test_multi_card_synthesis_asks_for_integration():
    prompt = _system_prompt(
        _make_request(
            [
                CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright),
                CardInSpread(name="The World", position="Future", orientation=Orientation.upright),
            ]
        )
    )
    assert "Do not recap the cards" in prompt


def test_single_card_synthesis_asks_for_a_takeaway_not_a_restatement():
    prompt = _system_prompt(_make_system_request())
    assert "single-card reading" in prompt
    assert "Do not restate the card interpretation" in prompt


def test_significators_synthesis_asks_for_a_character_portrait():
    prompt = _system_prompt(_make_system_request("Significators"))
    assert "portrait of the querent" in prompt
    assert "day number, life" in prompt


def _multi_card_prompt(lens: InterpretationLens) -> str:
    return _system_prompt(
        _make_request(
            [
                CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright),
                CardInSpread(name="The World", position="Future", orientation=Orientation.upright),
            ],
            settings=_settings(lens=lens),
        )
    )


def test_multi_card_synthesis_reads_the_spread_geometry():
    prompt = _multi_card_prompt(InterpretationLens.traditional)
    assert "geometry of the spread" in prompt


def test_every_lens_emits_its_own_synthesis_clause():
    # Distinct clauses, or a lens synthesis is decoration — same test as LENS.
    assert len(set(LENS_SYNTHESIS.values())) == len(InterpretationLens)
    for lens in InterpretationLens:
        assert LENS_SYNTHESIS[lens] in _multi_card_prompt(lens)


def test_multi_card_synthesis_is_a_window_not_a_portrait():
    """Regression: a Tree of Life synthesis described 'a personality that tries to
    secure itself...' — static character traits. A drawn spread captures a moment in
    motion; only the significator chart is a deliberate character portrait."""
    prompt = _multi_card_prompt(InterpretationLens.esoteric)
    assert "a window, not a portrait" in prompt
    significators = _system_prompt(_make_system_request("Significators"))
    assert "a window, not a portrait" not in significators
    assert "portrait of the querent" in significators


def test_esoteric_synthesis_anchors_in_spread_structure():
    """Regression: a Tree of Life spread under the esoteric lens produced a synthesis
    that never named a sephira — position names are themselves correspondences there."""
    prompt = _multi_card_prompt(InterpretationLens.esoteric)
    assert "Anchor the synthesis in the spread's own structure" in prompt


def test_single_card_synthesis_has_no_lens_clause():
    prompt = _system_prompt(
        _make_system_request(settings=_settings(lens=InterpretationLens.esoteric))
    )
    assert LENS_SYNTHESIS[InterpretationLens.esoteric] not in prompt


def test_significators_synthesis_has_no_lens_clause():
    prompt = _system_prompt(
        _make_system_request("Significators", settings=_settings(lens=InterpretationLens.esoteric))
    )
    assert LENS_SYNTHESIS[InterpretationLens.esoteric] not in prompt


# --- Word budget ---


def test_budget_matches_the_frontend_hint():
    """The slider promises "60% - ~180 words per card in a 3-card spread"."""
    words_per_card, synthesis_words = word_budget(depth=60, card_count=3)
    assert words_per_card == 182
    assert synthesis_words == 234


def test_per_card_share_shrinks_as_the_spread_grows():
    three, _ = word_budget(depth=60, card_count=3)
    ten, _ = word_budget(depth=60, card_count=10)
    assert ten < three


def test_depth_scales_the_total():
    shallow_card, shallow_synth = word_budget(depth=0, card_count=3)
    deep_card, deep_synth = word_budget(depth=100, card_count=3)
    assert deep_card > shallow_card
    assert deep_synth > shallow_synth


def test_budget_reaches_the_documented_bounds():
    assert sum(word_budget(depth=0, card_count=1)) == 150
    assert sum(word_budget(depth=100, card_count=1)) == 1200


def test_both_prompts_state_the_same_request_derived_budget():
    """word_budget is a pure function of the request, so the system prompt's OUTPUT
    block and the user prompt's Length line always agree without any threading."""
    request = _make_system_request(settings=_settings(depth=60))
    words_per_card, synthesis_words = request_word_budget(request)
    assert f"approximately {words_per_card} words" in build_system_prompt(request)
    assert f"approximately {synthesis_words} words" in build_system_prompt(request)
    user_prompt = build_user_prompt(request)
    assert f"roughly {words_per_card} words per card" in user_prompt
    assert f"roughly {synthesis_words} words for the synthesis" in user_prompt


def test_request_word_budget_matches_depth_and_distinct_card_count():
    request = _make_system_request(settings=_settings(depth=60))
    assert request_word_budget(request) == word_budget(60, 1)


# --- Distinct card counting ---


def _repeated_card_request(spread_name: str) -> InterpretationRequest:
    card = CardInSpread(
        name="The Empress", position="life number 1", orientation=Orientation.upright
    )
    same = CardInSpread(
        name="The Empress", position="life number 2", orientation=Orientation.upright
    )
    return _make_request([card, same], question=None, spread_name=spread_name)


def test_distinct_count_dedupes_repeated_cards_for_significators():
    assert _distinct_card_count(_repeated_card_request("Significators")) == 1


def test_distinct_count_does_not_dedupe_for_other_spreads():
    assert _distinct_card_count(_repeated_card_request("Celtic Cross")) == 2


# --- Completion-token cap ---


def test_completion_cap_grows_with_spread_size():
    small = max_completion_tokens(word_budget(depth=0, card_count=1), 1, "medium")
    large = max_completion_tokens(word_budget(depth=100, card_count=12), 12, "medium")
    assert small < large
    # Both must sit under the default config ceiling (10000), or the clamp warning fires
    # on well-formed requests.
    assert large < 10000


def test_completion_cap_grows_with_depth():
    shallow = max_completion_tokens(word_budget(depth=0, card_count=3), 3, "medium")
    deep = max_completion_tokens(word_budget(depth=100, card_count=3), 3, "medium")
    assert shallow < deep


def test_completion_cap_grows_with_reasoning_effort():
    budget = word_budget(depth=60, card_count=3)
    caps = [max_completion_tokens(budget, 3, effort) for effort in REASONING_HEADROOM]
    assert caps == sorted(caps)
    assert len(set(caps)) == len(caps)


def test_completion_cap_covers_observed_usage():
    """Calibration pin: the worst real call (11-card Tree of Life, depth 100, medium
    reasoning) used 3,161 completion tokens — the derived cap must clear it with margin."""
    cap = max_completion_tokens(word_budget(depth=100, card_count=11), 11, "medium")
    assert cap > 3161 * 1.5


def test_completion_cap_rejects_unknown_effort():
    # Config's Literal constrains the value; a drifted string must fail loudly, not guess.
    with pytest.raises(KeyError):
        max_completion_tokens(word_budget(depth=60, card_count=3), 3, "extreme")
