"""Lean prompt builder — pure functions, no I/O.

No card data is sent: the model reads from its own knowledge of the Rider–Waite deck
(plus numerology and astrology), and returns one woven narrative (`LeanReading`).
Design: docs/prompts/lean_prompt_architecture.md.

The word budget is server-owned (`Settings.llm_words_per_card` × cards — no client
input) and stated once as a ceiling: phrased that way the model lands within ±3%;
phrased as "roughly N words" it overshot by ~20%.

Spread variants are keyed off `spread_name`: `Significators` (a portrait chart, not a
situational reading — no question axis, no reversal block: each card is a fixed facet
of character) and `Tree of Life` (the three-pillar temporal structure baked in). For
every variant the position meanings arrive per card from the frontend. Reversed
guidance appears in both situational variants.
"""

import math
from dataclasses import dataclass
from typing import get_args

from src.core.config import ReasoningEffort, settings
from src.llm.schemas import (
    SIGNIFICATORS_SPREAD,
    TREE_OF_LIFE_SPREAD,
    InterpretationRequest,
)

# Prose→token conversion with margin: English runs ≈1.3 tokens per word (measured 1.3–1.4
# on real readings, JSON escaping included), plus the model's habit of overshooting.
TOKENS_PER_WORD = 1.6

# The single-field JSON envelope around the narrative.
RESPONSE_OVERHEAD_TOKENS = 40

# Reasoning tokens draw from the same max_completion_tokens budget as the prose, and grow
# with effort and spread size (observed at medium: 329–1,905). Underestimating truncates a
# response we already paid reasoning for, so each tier carries roughly 2–3× the worst
# usage observed at the tier below it.
REASONING_HEADROOM: dict[str, int] = {
    "none": 500,
    "low": 2000,
    "medium": 4000,
    "high": 8000,
    "xhigh": 12000,
}

# Fail at import, not at request time, if the config Literal and this table drift apart.
if set(REASONING_HEADROOM) != set(get_args(ReasoningEffort)):
    raise RuntimeError("REASONING_HEADROOM out of sync with config.ReasoningEffort")


# Verbatim across every situational spread variant (Standard, Tree of Life — not
# Significators, which has no question axis and reads each card as a fixed facet of
# character rather than a passing energy).
_QUESTION_ANALYSIS = """First determine what the question asks: its subject, the people involved and how each relates \
to the querent, and the kind of answer sought. Let that govern every interpretive choice. The \
broader or more open the question — or when none is given — the more freedom you have to let \
the spread itself set the agenda."""

_REVERSAL_GUIDANCE = """Honor each card's orientation. A reversal is not simple negation: read it as the card's energy \
blocked, delayed, internalized or in shadow — whichever the question and position make apt."""

# The situational splice shared by Standard and Tree of Life.
_QUESTION_REVERSAL = _QUESTION_ANALYSIS + "\n\n" + _REVERSAL_GUIDANCE

_CLOSING_INSTRUCTIONS = """Write about {total_words} words — treat that as a ceiling, not a target to exceed. Address \
the querent directly. Every sentence must earn its place: no textbook boilerplate, no \
hedging, no restating the question."""


_STANDARD_TEMPLATE = (
    """You are a master tarot reader working with the Rider–Waite deck, \
drawing on your own deep knowledge of the cards — their imagery, traditional meanings and \
correspondences. You may also draw on the allied mystical arts of numerology and astrology \
where they aid the interpretation.

"""
    + _QUESTION_REVERSAL
    + """

Read each card through its position. A stated position meaning governs the card's scope; where \
only a position name is given, read the name; where neither, read the cards in the order dealt.

Write the reading as one continuous, flowing narrative — not card-by-card sections. Move \
through the spread naturally, letting each card enter the story where it belongs (usually the \
order dealt), naming each card explicitly as it arrives. Every card must be woven in and do \
real work in the narrative with roughly a paragraph's weight; draw out the arc across \
positions and the reinforcements and tensions between cards, and land on what it all resolves \
to for the question.

"""
    + _CLOSING_INSTRUCTIONS
)


# A significator chart is calculated from birth data, not drawn: a portrait of the
# querent's character and personality, not a situational reading — so no question
# analysis and no reversal block; each card is a permanent facet of who the querent is.
_SIGNIFICATORS_TEMPLATE = """You are a master tarot reader working with the Rider–Waite deck, \
drawing on your own deep knowledge of the cards — their imagery, traditional meanings and \
correspondences — and on the allied mystical arts of numerology and astrology, which matter \
especially here.

You are interpreting a personal significator chart: a numerological and astrological profile \
calculated from the querent's birth data. This is not a situational reading and nothing in it \
is passing energy or advice — each card is a permanent facet of who the querent is. Explore \
the full depth of each card's expression as it shapes character and personality.

The chart's positions and what each governs are given with the cards — read each card \
through its stated position meaning.

A card may appear in more than one position. Read each appearance through its own position — \
the repetition itself is meaningful: that energy is doubly written into the chart. Never \
repeat an interpretation, but you can comment on the fact that the card has appeared again \
in this reading.

Write the portrait as card-by-card sections. Then at the end write one final paragraph  \
which sums up the chart giving a woven final elegant interpretation \
and land on a cohesive picture of the persons character and life \
themes.

Write about {total_words} words — treat that as a ceiling, not a target to exceed. \
 Every sentence must earn its place: no textbook boilerplate, no \
hedging."""


# Situational like the standard reading, but position handling is recast for the Tree:
# the frontend sends each card's zone and its meaning (like any spread); the template
# keeps only the spread-level pillar structure no single card line can carry.
_TREE_OF_LIFE_TEMPLATE = (
    """You are a master tarot reader working with the Rider–Waite deck, \
drawing on your own deep knowledge of the cards — their imagery, traditional meanings and \
correspondences. You may also draw on the allied mystical arts of numerology, astrology and \
the Kabbalah, which matter especially here.

"""
    + _QUESTION_REVERSAL
    + """

This spread maps the situation onto the eleven zones of the Tree of Life. Each card arrives \
with its zone and the zone's meaning — read the card through that zone and through its \
pillar's temporal current:

- The Pillar of Mercy (right — Chokmah, Chesed, Netzach) is masculine and expansive and \
carries future energies and influences: Chokmah the near future, Chesed the future not so \
near.
- The Pillar of Severity (left — Binah, Geburah, Hod) is feminine and constraining and \
carries the past energies still working on the situation.
- The Middle Pillar (Kether, Tiphareth, Yesod, Malkuth) is the present axis: the descent from \
the situation's spiritual root at Kether to its manifest outcome at Malkuth.

Write the reading as one continuous, flowing narrative — not card-by-card sections. Move \
through the Tree in the zones' numbered order — Kether, Chokmah, Binah, Chesed, Geburah, \
Tiphareth, Netzach, Hod, Yesod, Malkuth, and Daath last — naming each card explicitly as it \
arrives. Every card must be woven in and do real work in the narrative with roughly a \
paragraph's weight; draw out the currents between the pillars, the reinforcements and \
tensions between cards, and land on what the whole Tree resolves to for the question.

"""
    + _CLOSING_INSTRUCTIONS
)


@dataclass(frozen=True)
class _SpreadVariant:
    """Everything that differs about how a spread variant is built. One entry per
    variant here is the whole cost of adding a new one — no new branch needed in any
    function below."""

    template: str
    dedupe_cards: bool = False
    # Name of the Settings field to scale words-per-card by, or None for no scaling.
    budget_scale_setting: str | None = None
    has_question: bool = True


_SPREAD_VARIANTS: dict[str, _SpreadVariant] = {
    SIGNIFICATORS_SPREAD: _SpreadVariant(
        template=_SIGNIFICATORS_TEMPLATE,
        dedupe_cards=True,
        budget_scale_setting="significator_budget_scale",
        has_question=False,
    ),
    TREE_OF_LIFE_SPREAD: _SpreadVariant(template=_TREE_OF_LIFE_TEMPLATE),
}
_DEFAULT_VARIANT = _SpreadVariant(template=_STANDARD_TEMPLATE)


def _variant_for(spread_name: str) -> _SpreadVariant:
    return _SPREAD_VARIANTS.get(spread_name, _DEFAULT_VARIANT)


def distinct_card_count(request: InterpretationRequest) -> int:
    """Significator charts can repeat a card across positions (the Life number reduces
    through several cards); repeats share one budget slot. Every other spread counts
    cards as dealt."""
    if _variant_for(request.spread_name).dedupe_cards:
        return len({card.name for card in request.cards})
    return len(request.cards)


def total_word_budget(card_count: int, spread_name: str) -> int:
    """Total reading length: linear in the (distinct) card count, scaled up for
    significator charts."""
    scale_setting = _variant_for(spread_name).budget_scale_setting
    words_per_card: float = settings.llm_words_per_card
    if scale_setting:
        words_per_card *= getattr(settings, scale_setting)
    return round(words_per_card * card_count)


def request_word_budget(request: InterpretationRequest) -> int:
    """The total word budget for a request."""
    return total_word_budget(distinct_card_count(request), request.spread_name)


def max_completion_tokens(total_words: int, reasoning_effort: str) -> int:
    """The per-request completion-token cap: budgeted prose, JSON envelope, reasoning
    headroom."""
    return (
        math.ceil(total_words * TOKENS_PER_WORD)
        + RESPONSE_OVERHEAD_TOKENS
        + REASONING_HEADROOM[reasoning_effort]
    )


def clamped_completion_cap(total_words: int, reasoning_effort: str, configured_max: int) -> int:
    """The completion cap OpenAIAdapter actually calls the provider with: the derived
    per-request cap, clamped to the configured absolute ceiling.

    The single source for this clamp — the budget-gate reservation (`pricing.py`) must
    reserve against exactly what the adapter can spend, so both call this rather than
    each re-deriving `min(configured_max, derived_cap)` independently."""
    return min(configured_max, max_completion_tokens(total_words, reasoning_effort))


def build_system_prompt(request: InterpretationRequest) -> str:
    total_words = request_word_budget(request)
    return _variant_for(request.spread_name).template.format(total_words=total_words)


def build_user_prompt(request: InterpretationRequest) -> str:
    lines: list[str] = []
    if _variant_for(request.spread_name).has_question:
        # The chart is its own subject — a question line only applies to situational
        # spreads.
        if request.question:
            lines.append(f"Question: {request.question}")
        else:
            lines.append("No question was asked — let the spread itself set the agenda.")
        lines.append("")

    count = len(request.cards)
    lines.append(f"Spread: {request.spread_name} ({count} card{'s' if count > 1 else ''})")
    for i, card in enumerate(request.cards, start=1):
        line = f"{i}. {card.name} ({card.orientation.value})"
        if card.position:
            line += f" — {card.position}"
        if card.position_description:
            line += f": {card.position_description}"
        lines.append(line)
    return "\n".join(lines)
