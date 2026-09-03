"""Lean prompt builder — spec: docs/prompts/lean_prompt_architecture.md §2–§3.

Carried forward from the legacy builder tests: spread structure in the user prompt,
the significators fork, distinct-card counting, and the completion-token cap. New
here: no card data in any prompt, the Tree of Life variant, and the server-owned
linear word budget. There is no intent axis: interpretations have no settings.
"""

import pytest

from src.core.config import settings
from src.llm.prompt_builder import (
    REASONING_HEADROOM,
    build_system_prompt,
    build_user_prompt,
    clamped_completion_cap,
    distinct_card_count,
    max_completion_tokens,
    request_word_budget,
    total_word_budget,
)
from src.llm.schemas import (
    CardInSpread,
    InterpretationRequest,
    Orientation,
)


def _make_request(
    cards: list[CardInSpread],
    question: str | None = "What lies ahead?",
    spread_name: str = "Past-Present-Future",
) -> InterpretationRequest:
    return InterpretationRequest(
        spread_name=spread_name,
        question=question,
        cards=cards,
    )


def _make_system_request(spread_name: str = "Past-Present-Future") -> InterpretationRequest:
    return _make_request(
        [CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright)],
        spread_name=spread_name,
    )


# --- User prompt: spread structure ---


def test_user_prompt_contains_question():
    req = _make_request(
        [CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright)]
    )
    assert "What lies ahead?" in build_user_prompt(req)


def test_user_prompt_no_question_lets_the_spread_set_the_agenda():
    """Echoes the system prompt's own framing of the no-question case, rather than
    introducing a separate "general reading" term."""
    req = _make_request(
        [CardInSpread(name="The Fool", orientation=Orientation.upright)], question=None
    )
    assert "No question was asked — let the spread itself set the agenda." in build_user_prompt(req)


def test_user_prompt_card_line_carries_name_orientation_position_and_meaning():
    req = _make_request(
        [
            CardInSpread(
                name="Five of Pentacles",
                position="Present",
                orientation=Orientation.reversed,
                position_description="The heart of the matter as it stands now.",
            )
        ]
    )
    prompt = build_user_prompt(req)
    assert (
        "1. Five of Pentacles (reversed) — Present: The heart of the matter as it stands now."
        in prompt
    )


def test_user_prompt_omits_position_when_none():
    req = _make_request([CardInSpread(name="Ace of Wands", orientation=Orientation.upright)])
    prompt = build_user_prompt(req)
    assert "1. Ace of Wands (upright)" in prompt
    assert "—" not in prompt.split("\n")[-1]


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
    assert "1. Ace of Wands (upright): How you feel about them" in build_user_prompt(req)


def test_user_prompt_contains_spread_header_and_every_card():
    req = _make_request(
        [
            CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright),
            CardInSpread(name="Ace of Cups", position="Present", orientation=Orientation.reversed),
            CardInSpread(name="The World", position="Future", orientation=Orientation.upright),
        ]
    )
    prompt = build_user_prompt(req)
    assert "Spread: Past-Present-Future (3 cards)" in prompt
    for fragment in ("The Fool", "Ace of Cups", "The World", "Past", "Present", "Future"):
        assert fragment in prompt


def test_user_prompt_contains_no_card_meanings():
    """The lean design sends no card data — the model reads from its own knowledge."""
    req = _make_request(
        [CardInSpread(name="The Fool", position="Past", orientation=Orientation.upright)]
    )
    prompt = build_user_prompt(req)
    for legacy_marker in ("Keywords:", "Archetype:", "Upright —", "Astrology:", "Kabbalah:"):
        assert legacy_marker not in prompt


# --- System prompt: standard template ---


def test_system_prompt_names_the_deck_and_own_knowledge():
    prompt = build_system_prompt(_make_system_request())
    assert "Rider–Waite" in prompt
    assert "own deep knowledge" in prompt
    assert "numerology and astrology" in prompt


def test_system_prompt_gives_open_questions_freedom():
    prompt = build_system_prompt(_make_system_request())
    assert "the more freedom you have" in prompt


def test_system_prompt_carries_reversed_guidance():
    prompt = build_system_prompt(_make_system_request())
    assert "orientation" in prompt.lower()
    assert "reversal" in prompt.lower()


def test_system_prompt_position_fallback_chain():
    prompt = build_system_prompt(_make_system_request())
    assert "A stated position meaning governs the card's scope" in prompt
    assert "order dealt" in prompt


def test_system_prompt_demands_one_woven_narrative():
    prompt = build_system_prompt(_make_system_request())
    assert "one continuous, flowing narrative" in prompt
    assert "not card-by-card sections" in prompt
    assert "naming each card explicitly" in prompt


def test_system_prompt_states_budget_as_ceiling():
    req = _make_system_request()
    prompt = build_system_prompt(req)
    assert f"Write about {request_word_budget(req)} words" in prompt
    assert "a ceiling, not a target to exceed" in prompt


def test_question_analysis_flows_straight_into_reversal_guidance():
    """No intent axis exists: question analysis and reversal guidance sit exactly one
    blank line apart in both situational templates — no paragraph gap, no placeholder."""
    for spread_name in ("Past-Present-Future", "Tree of Life"):
        prompt = build_system_prompt(_make_system_request(spread_name))
        assert "This is a predictive reading" not in prompt
        assert "This is a reflective reading" not in prompt
        assert "set the agenda.\n\nHonor each card's orientation" in prompt
        assert "\n\n\n" not in prompt


def test_system_prompt_unknown_spread_returns_default():
    default = build_system_prompt(_make_system_request())
    assert build_system_prompt(_make_system_request("Unknown Spread")) == default
    assert build_system_prompt(_make_system_request("Celtic Cross")) == default


# --- Significators variant ---


def test_significators_is_a_portrait_not_a_situational_reading():
    prompt = build_system_prompt(_make_system_request("Significators"))
    assert prompt != build_system_prompt(_make_system_request())
    assert "significator chart" in prompt.lower()
    assert "character" in prompt.lower()
    assert "personality" in prompt.lower()
    assert "life themes" in prompt.lower()


def test_significators_positions_come_from_the_frontend():
    """The chart's position semantics arrive per card (position/position_description)
    from the frontend — the template no longer bakes in the position list."""
    prompt = build_system_prompt(_make_system_request("Significators"))
    for position in ("Day number", "Life number", "Star sign", "Decanate"):
        assert position not in prompt
    assert "given with the cards" in prompt


def test_significators_omits_question_analysis():
    """A fixed character chart has no question axis — the portrait is its own subject."""
    prompt = build_system_prompt(_make_system_request("Significators"))
    assert "what the question asks" not in prompt


def test_significators_user_prompt_has_no_question_line():
    req = _make_request(
        [CardInSpread(name="The Sun", position="Star sign", orientation=Orientation.upright)],
        question=None,
        spread_name="Significators",
    )
    prompt = build_user_prompt(req)
    assert "No question was asked" not in prompt
    assert prompt.startswith("Spread: Significators")


# --- Tree of Life variant ---


def test_tree_of_life_zone_meanings_come_from_the_frontend():
    """The eleven zone meanings arrive per card from the frontend — the template no
    longer bakes in the zones list, only the spread-level pillar structure."""
    prompt = build_system_prompt(_make_system_request("Tree of Life"))
    assert "The zones:" not in prompt
    assert "Kether (1)" not in prompt
    assert "arrives with its zone" in prompt


def test_tree_of_life_narrative_moves_in_zone_number_order():
    """The narrative traverses the zones in their numbered order, Daath last — not
    'naturally' / model's choice, which wandered the Tree in whatever order it liked."""
    prompt = build_system_prompt(_make_system_request("Tree of Life"))
    assert (
        "Kether, Chokmah, Binah, Chesed, Geburah, Tiphareth, Netzach, Hod, Yesod, "
        "Malkuth, and Daath last"
    ) in prompt
    assert "naturally" not in prompt
    assert "lightning flash" not in prompt


def test_tree_of_life_keeps_the_pillar_structure():
    prompt = build_system_prompt(_make_system_request("Tree of Life"))
    assert "Pillar of Mercy" in prompt
    assert "Pillar of Severity" in prompt
    assert "Middle Pillar" in prompt


def test_tree_of_life_stays_situational():
    """Unlike significators, the Tree keeps question analysis and reversals."""
    prompt = build_system_prompt(_make_system_request("Tree of Life"))
    assert "what the question asks" in prompt
    assert "reversal" in prompt.lower()




# --- Word budget (server-owned, linear) ---


def test_total_word_budget_is_linear_in_card_count():
    per_card = settings.llm_words_per_card
    assert total_word_budget(1, "Celtic Cross") == per_card
    assert total_word_budget(10, "Celtic Cross") == per_card * 10


def test_significators_budget_scales_per_card_weight():
    scaled = round(settings.llm_words_per_card * settings.significator_budget_scale)
    assert total_word_budget(4, "Significators") == scaled * 4


def test_budget_reads_config_not_module_constants(monkeypatch):
    monkeypatch.setattr(settings, "llm_words_per_card", 70)
    assert total_word_budget(3, "Celtic Cross") == 210


def _repeated_card_request(spread_name: str) -> InterpretationRequest:
    card = CardInSpread(
        name="The Empress", position="life number 1", orientation=Orientation.upright
    )
    same = CardInSpread(
        name="The Empress", position="life number 2", orientation=Orientation.upright
    )
    return _make_request([card, same], question=None, spread_name=spread_name)


def test_distinct_count_dedupes_repeated_cards_for_significators():
    assert distinct_card_count(_repeated_card_request("Significators")) == 1


def test_distinct_count_does_not_dedupe_for_other_spreads():
    assert distinct_card_count(_repeated_card_request("Celtic Cross")) == 2


def test_request_word_budget_uses_distinct_count_for_significators():
    req = _repeated_card_request("Significators")
    assert request_word_budget(req) == total_word_budget(1, "Significators")


# --- Completion-token cap ---


def test_completion_cap_grows_with_spread_size():
    small = max_completion_tokens(total_word_budget(1, "x"), "medium")
    large = max_completion_tokens(total_word_budget(12, "x"), "medium")
    assert small < large
    # Both must sit under the default config ceiling (10000), or the clamp warning
    # fires on well-formed requests.
    assert large < settings.openai_max_tokens


def test_completion_cap_grows_with_reasoning_effort():
    budget = total_word_budget(3, "x")
    caps = [max_completion_tokens(budget, effort) for effort in REASONING_HEADROOM]
    assert caps == sorted(caps)
    assert len(set(caps)) == len(caps)


def test_completion_cap_covers_observed_usage():
    """Calibration pin: the worst measured call (11-card Tree of Life, medium
    reasoning) used 3,403 completion tokens — the derived cap must clear it."""
    cap = max_completion_tokens(total_word_budget(11, "Tree of Life"), "medium")
    assert cap > 3403


def test_completion_cap_rejects_unknown_effort():
    # Config's Literal constrains the value; a drifted string must fail loudly, not guess.
    with pytest.raises(KeyError):
        max_completion_tokens(total_word_budget(3, "x"), "extreme")


# --- Clamped completion cap: the one shared source for the min(configured_max,
# derived_cap) clamp — both OpenAIAdapter and the budget-gate reservation call this
# rather than each re-deriving the same formula. ---


def test_clamped_cap_matches_the_derived_cap_when_under_the_ceiling():
    budget = total_word_budget(3, "x")
    derived = max_completion_tokens(budget, "medium")
    assert clamped_completion_cap(budget, "medium", derived + 500) == derived


def test_clamped_cap_is_capped_by_the_configured_ceiling():
    budget = total_word_budget(12, "x")
    derived = max_completion_tokens(budget, "medium")
    assert clamped_completion_cap(budget, "medium", derived - 500) == derived - 500
