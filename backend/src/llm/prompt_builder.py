"""Pure functions for building LLM prompt messages.

No I/O, no side effects — all state comes in via arguments.
Orientation determines which meaning fields are included: upright cards show upright
fields only; reversed cards show reversed fields only (both positive and negative aspects).
"""

from typing import Any

from src.llm import card_catalog
from src.llm.schemas import CardInSpread, InterpretationRequest, Orientation

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


def build_system_prompt() -> str:
    return _SYSTEM_PROMPT


def build_user_prompt(
    request: InterpretationRequest,
    meanings: dict[str, dict[str, Any]] | None = None,
) -> str:
    lines: list[str] = []
    if request.question:
        lines.append(f"Question: {request.question}")
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
