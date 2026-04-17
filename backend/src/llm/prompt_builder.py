"""Pure functions for building LLM prompt messages.

No I/O, no side effects — all state comes in via arguments.
Orientation determines which meaning fields are included: upright cards show upright
fields only; reversed cards show reversed fields only (both positive and negative aspects).
"""

from typing import Any

from src.llm import card_catalog
from src.llm.schemas import (
    SIGNIFICATORS_SPREAD,
    CardInSpread,
    InterpretationRequest,
    Orientation,
)

_SEP = ", "


_SYSTEM_PROMPT = (
    "You are an expert tarot reader with deep knowledge of esoteric symbolism, "
    "Kabbalah, and Jungian archetypes. You provide insightful, nuanced tarot "
    "interpretations that weave together the cards' individual meanings into a "
    "coherent narrative. When the querent provides a question, address it directly. "
    "When no question is given, let the cards and their positions speak — offer a "
    "general reading shaped by the spread name, layout and the energies present. "
    "Be thoughtful, specific, and grounded in the symbolism provided. "
    "Avoid generic statements — speak directly to the spread.\n\n"
    "ORIENTATION GUIDANCE:\n"
    "- Upright cards carry both strengths and challenges — acknowledge the shadow side "
    "where relevant rather than presenting a purely positive picture.\n"
    "- Reversed cards are not simply 'negative' — they carry both blocked/shadow energy "
    "and an opportunity for growth or inner work. Let the balance between these aspects "
    "be informed by the querent's question and how neighbouring cards in the spread "
    "shape the meaning.\n\n"
    "POSITION GUIDANCE:\n"
    "- Each card's position carries interpretive weight. When a position meaning is provided, "
    "let it shape how you read the card — the same card means something different in a "
    "'Fire' position (will, drive) than in a 'Water' position (emotions, intuition).\n\n"
    "FORMAT INSTRUCTIONS:\n"
    "- For each card, provide a focused interpretation tied to the querent's question. "
    "Explain how this card in this position speaks to what the querent is asking — "
    "not a generic textbook definition. Be thorough enough to honour the symbolism "
    "but concise enough that every sentence earns its place.\n"
    "- For multi-card spreads, the synthesis is the heart of the reading: weave all cards "
    "into one cohesive narrative that directly addresses the question. The synthesis should "
    "be the most substantial part of the response — not a recap of individual cards, but an "
    "integrated insight.\n"
    "- For single-card readings, do not restate the card interpretation in the synthesis. "
    "Instead, offer a practical takeaway — actionable guidance, a reflective question for "
    "the querent to sit with, or a concrete step they can take based on the card's message."
)

_SIGNIFICATORS_SYSTEM_PROMPT = (
    "You are an expert tarot reader with deep knowledge of esoteric symbolism, "
    "Kabbalah, and Jungian archetypes. You are interpreting a personal significator "
    "chart — a numerological and astrological profile derived from the querent's "
    "birth data. This is not a situational reading; it is a portrait of the querent's "
    "innate character, life themes, and spiritual makeup.\n\n"
    "SIGNIFICATOR GUIDANCE:\n"
    "- Every card in this chart is upright. These are not drawn at random — they are "
    "calculated from the querent's birth date and star sign. Treat each card as a "
    "permanent facet of who the querent is, not as passing energy or advice.\n"
    "- Do not reference reversed meanings, shadow sides, or challenges in the way you "
    "would for a standard reading. Instead, explore the full depth of each card's "
    "upright expression as it shapes the querent's character.\n\n"
    "POSITION GUIDANCE:\n"
    "- **Day number**: The card tied to the day of birth. It reflects the querent's "
    "outward personality — how they present to the world and their most visible traits.\n"
    "- **Life number**: Derived from the full birth date. When multiple cards share "
    "this position (e.g. life number 1, life number 2, life number 3), they represent "
    "facets of the same numerological energy. The original number reduces through these "
    "cards — interpret them as layers of the same core theme, each revealing a different "
    "dimension of the querent's life path.\n"
    "- **Star sign**: The Major Arcana connected to the querent's sun sign. It speaks to "
    "their deepest drives, core identity, and the archetypal energy they embody.\n"
    "- **Decanate**: A Minor Arcana card that bridges the querent's birth date to the "
    "everyday expression of their star sign energy. It grounds the Major Arcana themes "
    "in practical, lived experience.\n\n"
    "FORMAT INSTRUCTIONS:\n"
    "- For each card, provide a rich interpretation exploring what this significator "
    "reveals about the querent's character, personality, and life themes. Ground the "
    "reading in the card's symbolism, esoteric correspondences, and the specific "
    "position it occupies in the chart. These are character-defining cards — give "
    "each one the depth it deserves.\n"
    "- The synthesis should paint a cohesive portrait of the querent as a person — "
    "how their day number, life path, star sign, and decanate interact, reinforce, "
    "or temper each other. This is the heart of the chart: an integrated character "
    "study, not a summary of individual cards."
)


def build_system_prompt(spread_name: str | None = None) -> str:
    if spread_name == SIGNIFICATORS_SPREAD:
        return _SIGNIFICATORS_SYSTEM_PROMPT
    return _SYSTEM_PROMPT


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
        position_line = f"\n{i}. {card.name} ({card.orientation.value}) — Position: {card.position}"
        if card.position_description:
            position_line += f"\n  Position meaning: {card.position_description}"
        lines.append(position_line)
        if meaning is not None:
            lines.append(_format_card(card, meaning))

    return "\n".join(lines)


def _format_card(card: CardInSpread, meaning: dict[str, Any]) -> str:
    if card_catalog.is_major_arcana(card.name):
        return _format_major_arcana(meaning, card.orientation)
    block = _format_suit_context(card.name)
    block += _format_minor_arcana(meaning, card.orientation)
    if card_catalog.is_court_card(card.name):
        block += "\n" + _format_court_meta(meaning)
    return block


def _format_major_arcana(card: dict[str, Any], orientation: Orientation) -> str:
    meta = card.get("meta", {})
    archetype = meta.get("archetype", "")
    keywords: list[str] = meta.get("keywords", [])

    if orientation == Orientation.upright:
        upright = card.get("upright", {})
        positive: list[str] = upright.get("positive", [])
        negative: list[str] = upright.get("negative", [])
        parts = [f"  Upright — {_SEP.join(positive)}"]
        if negative:
            parts.append(f"  Challenges — {_SEP.join(negative)}")
    else:
        reversed_ = card.get("reversed", {})
        pos: list[str] = reversed_.get("positive", [])
        neg: list[str] = reversed_.get("negative", [])
        parts = [f"  Reversed (shadow) — {_SEP.join(neg)}"]
        if pos:
            parts.append(f"  Reversed (growth) — {_SEP.join(pos)}")

    if archetype:
        parts.append(f"  Archetype: {archetype}")
    if keywords:
        parts.append(f"  Keywords: {_SEP.join(keywords)}")

    esoteric = _format_esoteric_meta(meta)
    if esoteric:
        parts.append(esoteric)

    return "\n".join(parts)


def _format_esoteric_meta(meta: dict[str, Any]) -> str:
    parts: list[str] = []

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
        planets = astro.get("planet", [])
        astro_str = f"  Astrology: {sign}"
        if planets:
            astro_str += f" ({_SEP.join(planets)})"
        parts.append(astro_str)

    esoteric = meta.get("esoteric", {})
    if kabbalah := esoteric.get("kabbalah"):
        parts.append(f"  Kabbalah: {kabbalah}")
    if alchemy := esoteric.get("alchemy"):
        parts.append(f"  Alchemy: {_SEP.join(alchemy)}")

    numerology = meta.get("numerology", {})
    if num_meaning := numerology.get("meaning"):
        num = numerology.get("number", "")
        reduction = numerology.get("reduction", "")
        parts.append(f"  Numerology: {num} → {reduction} — {num_meaning}")

    return "\n".join(parts)


def _format_suit_context(card_name: str) -> str:
    suit = card_catalog.get_suit_info(card_name)
    if suit is None:
        return ""
    element = suit.get("element", "")
    temporal = suit.get("temporal", "")
    return f"  Suit: {suit.get('name', '')} ({element}) — temporal scope: {temporal}\n"


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
    return "  " + " | ".join(parts) if parts else ""
