"""Essentials only — trimmed ahead of the lean-prompt migration.

Tests pinning behavior the lean architecture removes (card-data rendering,
lens blocks, synthesis shapes, block ordering, client depth budget) are gone;
see docs/prompts/lean_prompt_architecture.md. What remains carries forward:
spread structure in the user prompt, the significators fork, intent phrasing,
distinct-card counting, and the completion-token cap.
"""

import pytest

from src.llm.prompt_builder import (
    REASONING_HEADROOM,
    _distinct_card_count,
    build_system_prompt,
    build_user_prompt,
    max_completion_tokens,
    word_budget,
)
from src.llm.schemas import (
    CardInSpread,
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


# --- User prompt: spread structure ---


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


def test_user_prompt_omits_position_when_none():
    req = _make_request([CardInSpread(name="Ace of Wands", orientation=Orientation.upright)])
    prompt = _user_prompt(req)
    assert "Position:" not in prompt
    assert "1. Ace of Wands (upright)" in prompt


def test_user_prompt_keeps_position_meaning_without_position_name():
    req = _make_request(
        [
            CardInSpread(
                name="Ace of Wands",
                orientation=Orientation.upright,
                position_description="How you feel about them",
            )
        ]
    )
    prompt = _user_prompt(req)
    assert "Position:" not in prompt
    assert "Position meaning: How you feel about them" in prompt


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


@pytest.mark.xfail(
    strict=True,
    reason="lean architecture: reversed guidance applies to ALL spreads, significators "
    "included (docs/prompts/lean_prompt_architecture.md §7) — the old builder omits it",
)
def test_significators_carries_reversed_guidance():
    prompt = _system_prompt(_make_system_request("Significators"))
    assert "orientation" in prompt.lower()
    assert "reversal" in prompt.lower()


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


def test_significators_omits_intent_block_for_every_intent():
    """A fixed character chart has no predictive/reflective axis — INTENT never
    appears for Significators, no matter which intent is requested."""
    for intent in ReadingIntent:
        prompt = _system_prompt(
            _make_system_request("Significators", settings=_settings(intent=intent))
        )
        assert "INTENT:" not in prompt
    assert "INTENT:" in _system_prompt(_make_system_request())


def test_system_prompt_unknown_spread_returns_default():
    default = _system_prompt(_make_system_request())
    assert _system_prompt(_make_system_request("Unknown Spread")) == default
    assert _system_prompt(_make_system_request("Celtic Cross")) == default


# --- Intent ---


def test_reflective_forbids_forecasting_and_predictive_requires_it():
    reflective = _system_prompt(
        _make_system_request(settings=_settings(intent=ReadingIntent.reflective))
    )
    predictive = _system_prompt(
        _make_system_request(settings=_settings(intent=ReadingIntent.predictive))
    )
    assert "Do not forecast events." in reflective
    assert "Name likely developments" in predictive


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
