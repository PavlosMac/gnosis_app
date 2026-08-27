"""Pure functions for building LLM prompt messages.

No I/O, no side effects — all state comes in via arguments.
Orientation determines which meaning fields are included: upright cards show upright
fields only; reversed cards show reversed fields only (both positive and negative aspects).

The system prompt is composed from ordered blocks in `prompt_components`; this module
renders the card data those blocks instruct the model to read, and derives the word
budget from the querent's depth setting. `word_budget` is a pure function of the
request, so both prompt builders derive it internally and always agree.
"""

import math
from typing import Any, get_args

from src.core.config import ReasoningEffort
from src.llm import card_catalog, prompt_components
from src.llm.schemas import (
    SIGNIFICATORS_SPREAD,
    CardInSpread,
    InterpretationRequest,
    Orientation,
)

_SEP = ", "

# Total reading length at depth 0 and depth 100. Mirrored by the frontend's
# `estimatedWordsPerCard` hint — changing these without changing that makes the slider
# lie about what it will produce.
MIN_TOTAL_WORDS = 150
MAX_TOTAL_WORDS = 1200

# Synthesis takes this share of the total; the cards divide the rest between them.
SYNTHESIS_SHARE = 0.3

# Prose→token conversion with margin: English runs ≈1.3 tokens per word (measured 1.3–1.4 on
# real readings, JSON escaping included), plus the model's habit of overshooting the target.
TOKENS_PER_WORD = 1.6

# Each JSON entry echoes card_name/position/orientation plus structural punctuation.
CARD_ENTRY_OVERHEAD_TOKENS = 40

# Reasoning tokens draw from the same max_completion_tokens budget as the prose, and grow with
# effort and spread size (observed at medium: 176–1,511). Underestimating truncates a response
# we already paid reasoning for, so each tier carries roughly 2–3× the worst usage observed at
# the tier below it.
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


def max_completion_tokens(budget: tuple[int, int], card_count: int, reasoning_effort: str) -> int:
    """The per-request completion-token cap: budgeted prose, JSON echo, reasoning headroom.

    `card_count` is the raw card count (len(request.cards)), not the distinct count the word
    budget divides by — the output echoes one JSON entry per card as given, so duplicate
    significator cards still produce entries. Overestimating there is the safe direction.
    """
    words_per_card, synthesis_words = budget
    prose_words = words_per_card * card_count + synthesis_words
    return (
        math.ceil(prose_words * TOKENS_PER_WORD)
        + CARD_ENTRY_OVERHEAD_TOKENS * card_count
        + REASONING_HEADROOM[reasoning_effort]
    )


def word_budget(depth: int, card_count: int) -> tuple[int, int]:
    """Return (words_per_card, synthesis_words) for a depth setting and spread size.

    The total scales with depth; the per-card share shrinks as the spread grows, so a
    ten-card spread does not produce ten times the prose of a one-card draw.
    """
    total = MIN_TOTAL_WORDS + (MAX_TOTAL_WORDS - MIN_TOTAL_WORDS) * depth / 100
    synthesis_words = round(total * SYNTHESIS_SHARE)
    words_per_card = round(total * (1 - SYNTHESIS_SHARE) / card_count)
    return words_per_card, synthesis_words


def _distinct_card_count(request: InterpretationRequest) -> int:
    if request.spread_name == SIGNIFICATORS_SPREAD:
        return len({card.name for card in request.cards})
    return len(request.cards)


def request_word_budget(request: InterpretationRequest) -> tuple[int, int]:
    """The (words_per_card, synthesis_words) budget for a request."""
    return word_budget(request.settings.depth, _distinct_card_count(request))


def build_system_prompt(request: InterpretationRequest) -> str:
    words_per_card, synthesis_words = request_word_budget(request)
    return prompt_components.build_prompt(
        lens=request.settings.lens,
        intent=request.settings.intent,
        spread_name=request.spread_name,
        card_count=_distinct_card_count(request),
        words_per_card=words_per_card,
        synthesis_words=synthesis_words,
    )


def build_user_prompt(
    request: InterpretationRequest,
    meanings: dict[str, dict[str, Any]] | None = None,
) -> str:
    lines: list[str] = []
    if request.question:
        lines.append(f"Question: {request.question}")
    elif request.spread_name == SIGNIFICATORS_SPREAD:
        lines.append(
            "This is a personal significator chart. "
            "Interpret the cards as a portrait of the querent's character and life themes."
        )
    else:
        lines.append("No specific question — provide a general reading.")
    lines.append("")
    card_count = len(request.cards)
    lines.append(
        f"Spread: {request.spread_name} ({card_count} card{'s' if card_count > 1 else ''}):"
    )

    for i, card in enumerate(request.cards, start=1):
        meaning = (meanings or {}).get(card.name) or card_catalog.get_card_meaning(card.name)
        position_line = f"\n{i}. {card.name} ({card.orientation.value})"
        if card.position:
            position_line += f" — Position: {card.position}"
        if card.position_description:
            position_line += f"\n  Position meaning: {card.position_description}"
        lines.append(position_line)
        if meaning is not None:
            lines.append(_format_card(card, meaning))

    words_per_card, synthesis_words = request_word_budget(request)
    lines.append("")
    lines.append(
        f"Length: roughly {words_per_card} words per card, "
        f"and roughly {synthesis_words} words for the synthesis."
    )

    return "\n".join(lines)


def _format_card(card: CardInSpread, meaning: dict[str, Any]) -> str:
    """Correspondences first, meaning lists last.

    The lens blocks tell the model to anchor on the correspondences; on a major they
    are ~60 tokens against ~350 tokens of lists, so they go directly under the header
    where they are read first rather than after the lists where they were diluted.
    """
    if card_catalog.is_major_arcana(card.name):
        return _format_major_arcana(meaning, card.orientation)
    parts = [_format_suit_context(card.name)]
    if card_catalog.is_court_card(card.name):
        parts.append(_format_court_meta(meaning))
    else:
        parts.append(_format_esoteric_meta(meaning.get("meta", {})))
    parts.append(_format_minor_arcana(meaning, card.orientation))
    return "\n".join(p for p in parts if p)


def _format_major_arcana(card: dict[str, Any], orientation: Orientation) -> str:
    meta = card.get("meta", {})
    archetype = meta.get("archetype", "")
    keywords: list[str] = meta.get("keywords", [])

    parts: list[str] = []
    if archetype:
        parts.append(f"  Archetype: {archetype}")
    if keywords:
        parts.append(f"  Keywords: {_SEP.join(keywords)}")
    esoteric = _format_esoteric_meta(meta)
    if esoteric:
        parts.append(esoteric)

    if orientation == Orientation.upright:
        upright = card.get("upright", {})
        positive: list[str] = upright.get("positive", [])
        negative: list[str] = upright.get("negative", [])
        parts.append(f"  Upright — {_SEP.join(positive)}")
        if negative:
            parts.append(f"  Challenges — {_SEP.join(negative)}")
    else:
        reversed_ = card.get("reversed", {})
        pos: list[str] = reversed_.get("positive") or []
        neg: list[str] = reversed_.get("negative") or []
        parts.append(f"  Reversed (shadow) — {_SEP.join(neg)}")
        if pos:
            parts.append(f"  Reversed (growth) — {_SEP.join(pos)}")

    return "\n".join(parts)


def _format_esoteric_meta(meta: dict[str, Any]) -> str:
    """Render the correspondence lines shared by majors (Tsarion) and pips (Golden Dawn).

    Every field is optional: majors carry core/alchemy/mythic and no decan; pips carry
    title/decan and no core; Aces carry no astrology at all.
    """
    parts: list[str] = []

    if title := meta.get("title"):
        parts.append(f"  Title: {title}")

    core = meta.get("core", {})
    core_items: list[str] = []
    if element := core.get("element"):
        core_items.append(f"Element: {element}")
    if modality := core.get("modality"):
        core_items.append(f"Modality: {modality}")
    if core_items:
        parts.append("  " + " | ".join(core_items))

    astro = meta.get("astrology", {})
    if sign := astro.get("sign"):
        planets: list[str] = astro.get("planet") or []
        if decan := astro.get("decan"):
            astro_str = f"  Astrology: {_SEP.join(planets)} in {sign} — decan {decan}"
        else:
            astro_str = f"  Astrology: {sign}"
            if planets:
                astro_str += f" ({_SEP.join(planets)})"
        if season := astro.get("season"):
            astro_str += f" — season: {season}"
        parts.append(astro_str)

    esoteric = meta.get("esoteric", {})
    if kabbalah := esoteric.get("kabbalah"):
        parts.append(f"  Kabbalah: {kabbalah}")
    if alchemy := esoteric.get("alchemy"):
        parts.append(f"  Alchemy: {_SEP.join(alchemy)}")
    if mythic := esoteric.get("mythic"):
        parts.append(f"  Mythic: {_SEP.join(mythic)}")

    numerology = meta.get("numerology", {})
    if num_meaning := numerology.get("meaning"):
        num = numerology.get("number", "")
        reduction = numerology.get("reduction")
        num_str = f"  Numerology: {num}"
        if reduction is not None and reduction != num:
            num_str += f" → {reduction}"
        parts.append(f"{num_str} — {num_meaning}")

    return "\n".join(parts)


def _format_suit_context(card_name: str) -> str:
    suit = card_catalog.get_suit_info(card_name)
    if suit is None:
        return ""
    element = suit.get("element", "")
    temporal = suit.get("temporal", "")
    return f"  Suit: {suit.get('name', '')} ({element}) — temporal scope: {temporal}"


def _format_minor_arcana(card: dict[str, Any], orientation: Orientation) -> str:
    if orientation == Orientation.upright:
        upright: list[str] = card.get("upright", [])
        negative: list[str] = card.get("negative") or []
        parts = [f"  Upright — {_SEP.join(upright)}"]
        if negative:
            parts.append(f"  Challenges — {_SEP.join(negative)}")
    else:
        reversed_: list[str] = card.get("reversed") or []
        reversed_positive: list[str] = card.get("reversed_positive") or []
        parts = [f"  Reversed (shadow) — {_SEP.join(reversed_)}"]
        if reversed_positive:
            parts.append(f"  Reversed (growth) — {_SEP.join(reversed_positive)}")

    return "\n".join(parts)


def _format_court_meta(card: dict[str, Any]) -> str:
    meta = card.get("meta", {})
    parts: list[str] = []
    if kabbalah := meta.get("kabbalah"):
        parts.append(f"Kabbalah: {kabbalah}")
    if elemental := meta.get("elemental"):
        parts.append(f"Elemental: {elemental}")
    if psyche := meta.get("psyche"):
        parts.append(f"Psyche: {psyche}")
    if rules := meta.get("rules"):
        parts.append(f"Rules: {rules}")
    if age := meta.get("age_sex"):
        parts.append(f"Age: {age}")
    return "  " + " | ".join(parts) if parts else ""
