"""Experiment: lean prompt architecture — no card data, the model's own tarot knowledge.

Sends only the spread structure (question, positions, orientations, position
descriptions) plus a compact system prompt, and lets the model interpret from
its own knowledge of tarot. Writes each reading to a .md file for judging, with
token usage and a cost comparison against the current catalog-injecting prompts.

Usage:
    uv run python -m scripts.lean_prompt_test                 # both test spreads
    uv run python -m scripts.lean_prompt_test --model gpt-5.4 --effort medium
    uv run python -m scripts.lean_prompt_test --spread lisbon # one spread only
"""

import argparse
import asyncio
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast, get_args

from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from src.core.config import ReasoningEffort, settings
from src.llm.card_catalog import get_card_meaning
from src.llm.prompt_builder import (
    build_system_prompt,
    build_user_prompt,
    max_completion_tokens,
)
from src.llm.schemas import (
    CardInSpread,
    InterpretationLens,
    InterpretationRequest,
    InterpretationSettings,
    Orientation,
    ReadingIntent,
)


class LeanReading(BaseModel):
    """Response format for the lean experiment: one woven narrative, no per-card sections."""

    reading: str = Field(
        ...,
        description=(
            "The complete reading as one continuous narrative that weaves every card in, "
            "at the length the system prompt sets."
        ),
    )


# $ per 1M tokens (input, output), standard tier, as of 2026-09. None → tokens only.
PRICING: dict[str, tuple[float, float] | None] = {
    "gpt-5.4": (2.50, 15.00),
    "gpt-5.4-mini": (0.75, 4.50),
}

OUT_DIR = Path("docs/prompts/experiments")

# ---------------------------------------------------------------------------
# Lean prompt
# ---------------------------------------------------------------------------

LEAN_INTENT: dict[ReadingIntent, str] = {
    ReadingIntent.predictive: (
        "This is a predictive reading: name likely developments and outcomes. Where a "
        "card speaks only of a state or quality, say what that condition tends toward "
        "rather than manufacturing an event."
    ),
    ReadingIntent.reflective: (
        "This is a reflective reading: illuminate what is present, held or unresolved "
        "in the situation. Do not forecast events."
    ),
}


# Unlike the production budget (near-flat total split across the spread), the lean
# narrative scales linearly: depth sets the words per card — roughly a paragraph
# each at mid-depth — and the total grows with the spread.
MIN_WORDS_PER_CARD = 50
MAX_WORDS_PER_CARD = 150


def total_word_budget(request: InterpretationRequest) -> int:
    """One budget for the whole reading: depth-scaled words per card × card count."""
    depth = request.settings.depth
    per_card = MIN_WORDS_PER_CARD + (MAX_WORDS_PER_CARD - MIN_WORDS_PER_CARD) * depth / 100
    return round(per_card * len(request.cards))


def build_lean_system_prompt(request: InterpretationRequest) -> str:
    intent = LEAN_INTENT[request.settings.intent]
    return f"""You are a master tarot reader working with the Rider–Waite deck, drawing on your \
own deep knowledge of the cards — their imagery, traditional meanings and correspondences. You \
may also draw on the allied mystical arts of numerology and astrology where they aid the \
interpretation.

First determine what the question asks: its subject, the people involved and how each relates \
to the querent, and the kind of answer sought. Let that govern every interpretive choice. The \
broader or more open the question — or when none is given — the more freedom you have to let \
the spread itself set the agenda.

{intent}

Honor each card's orientation. A reversal is not simple negation: read it as the card's energy \
blocked, delayed, internalized or in shadow — whichever the question and position make apt.

Read each card through its position. A stated position meaning governs the card's scope; where \
only a position name is given, read the name; where neither, read the cards in the order dealt.

Write the reading as one continuous, flowing narrative — not card-by-card sections. Move \
through the spread naturally, letting each card enter the story where it belongs (usually the \
order dealt), naming each card explicitly as it arrives. Every card must be woven in and do \
real work in the \
narrative with roughly a paragraph's weight; draw out the arc across positions and the \
reinforcements and tensions between cards, and land on what it all resolves to for the question.

Write about {total_word_budget(request)} words — treat that as a ceiling, not a target to \
exceed. Address the querent directly. Every sentence must earn its place: no textbook \
boilerplate, no hedging, no restating the question."""


def build_lean_user_prompt(request: InterpretationRequest) -> str:
    lines: list[str] = []
    if request.question:
        lines.append(f"Question: {request.question}")
    else:
        lines.append("No specific question — provide a general reading.")
    lines.append("")
    lines.append(f"Spread: {request.spread_name} ({len(request.cards)} cards)")
    for i, card in enumerate(request.cards, start=1):
        line = f"{i}. {card.name} ({card.orientation})"
        if card.position:
            line += f" — {card.position}"
        if card.position_description:
            line += f": {card.position_description}"
        lines.append(line)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Test spreads
# ---------------------------------------------------------------------------

SPREADS: dict[str, InterpretationRequest] = {
    # Mirrors the SAMPLE_REQUEST in docs/prompts/prompt_reference.md for a direct
    # old-vs-new comparison on content and tokens.
    "lisbon": InterpretationRequest(
        spread_name="Past, Present, Future",
        question="Should I take the job offer in Lisbon?",
        cards=[
            CardInSpread(
                name="The Lovers",
                position="Past",
                orientation=Orientation.upright,
                position_description="What shaped the situation and is now receding.",
            ),
            CardInSpread(
                name="Five of Pentacles",
                position="Present",
                orientation=Orientation.reversed,
                position_description="The heart of the matter as it stands now.",
            ),
            CardInSpread(
                name="Queen of Cups",
                position="Future",
                orientation=Orientation.upright,
                position_description="The direction events take if nothing changes.",
            ),
        ],
        settings=InterpretationSettings(
            lens=InterpretationLens.esoteric,
            intent=ReadingIntent.reflective,
            depth=60,
        ),
    ),
    # Large predictive spread: tests scale, tone and cost at the other extreme.
    "celtic-cross": InterpretationRequest(
        spread_name="Celtic Cross",
        question="Will my relationship with Daniel survive the coming year?",
        cards=[
            CardInSpread(
                name="Two of Cups",
                position="Heart of the Matter",
                orientation=Orientation.upright,
                position_description="The core energy of the situation.",
            ),
            CardInSpread(
                name="Five of Swords",
                position="The Challenge",
                orientation=Orientation.upright,
                position_description="What crosses or tests it.",
            ),
            CardInSpread(
                name="The Moon",
                position="The Foundation",
                orientation=Orientation.reversed,
                position_description="The unconscious roots beneath the situation.",
            ),
            CardInSpread(
                name="Six of Cups",
                position="Recent Past",
                orientation=Orientation.upright,
                position_description="What is passing out of the situation.",
            ),
            CardInSpread(
                name="Four of Wands",
                position="The Crown",
                orientation=Orientation.upright,
                position_description="The best that can be attained here.",
            ),
            CardInSpread(
                name="Knight of Swords",
                position="Near Future",
                orientation=Orientation.upright,
                position_description="What approaches in the coming weeks.",
            ),
            CardInSpread(
                name="Queen of Cups",
                position="The Self",
                orientation=Orientation.reversed,
                position_description="The querent's own stance in the situation.",
            ),
            CardInSpread(
                name="Ten of Pentacles",
                position="The Environment",
                orientation=Orientation.upright,
                position_description="Outside influences and the people around the querent.",
            ),
            CardInSpread(
                name="The Tower",
                position="Hopes and Fears",
                orientation=Orientation.reversed,
                position_description="What the querent both hopes for and dreads.",
            ),
            CardInSpread(
                name="The Star",
                position="The Outcome",
                orientation=Orientation.upright,
                position_description="Where the situation resolves within the year.",
            ),
        ],
        settings=InterpretationSettings(
            lens=InterpretationLens.traditional,
            intent=ReadingIntent.predictive,
            depth=70,
        ),
    ),
}


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------


def estimate_tokens(text: str) -> int:
    """Rough chars/4 estimate — good enough for an order-of-magnitude comparison."""
    return len(text) // 4


def old_prompt_token_estimate(request: InterpretationRequest) -> int | None:
    """Estimated input tokens of the current (catalog-injecting) architecture."""
    meanings = {}
    for card in request.cards:
        meaning = get_card_meaning(card.name)
        if meaning is None:
            return None
        meanings[card.name] = meaning
    old = build_system_prompt(request) + build_user_prompt(request, meanings)
    return estimate_tokens(old)


def cost_line(model: str, prompt_tokens: int, completion_tokens: int) -> str:
    pricing = PRICING.get(model)
    if pricing is None:
        return "_Set PRICING in the script for $ estimates._"
    inp, out = pricing
    dollars = prompt_tokens / 1e6 * inp + completion_tokens / 1e6 * out
    return f"**Estimated cost:** ${dollars:.5f} (@ ${inp}/1M in, ${out}/1M out)"


async def run_spread(
    client: AsyncOpenAI, slug: str, request: InterpretationRequest, model: str, effort: str
) -> Path:
    system_prompt = build_lean_system_prompt(request)
    user_prompt = build_lean_user_prompt(request)
    # The lean response is one JSON field, so budget the cap as a single "card".
    completion_cap = max_completion_tokens((total_word_budget(request), 0), 1, effort)

    response = await client.beta.chat.completions.parse(
        model=model,
        max_completion_tokens=completion_cap,
        reasoning_effort=cast(Any, effort),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format=LeanReading,
    )
    parsed = response.choices[0].message.parsed
    if parsed is None:
        raise RuntimeError(f"{slug}: empty/unparseable response")
    usage = response.usage
    details = usage.completion_tokens_details if usage else None
    reasoning = details.reasoning_tokens if details else None

    old_estimate = old_prompt_token_estimate(request)
    s = request.settings

    md: list[str] = [
        f"# Lean prompt test — {request.spread_name}",
        "",
        f"_Generated {datetime.now(UTC).strftime('%Y-%m-%d %H:%M UTC')}_",
        "",
        f"- **Model:** {response.model} (reasoning effort: {effort})",
        f"- **Question:** {request.question}",
        f"- **Intent / depth:** {s.intent} / {s.depth} (~{total_word_budget(request)} words)",
        "",
        "## Token cost",
        "",
        "| | tokens |",
        "|---|---|",
        f"| Input (lean) | {usage.prompt_tokens if usage else '?'} |",
        f"| Input, current architecture (est.) | {old_estimate or 'n/a'} |",
        f"| Output | {usage.completion_tokens if usage else '?'} |",
        f"| — of which reasoning | {reasoning if reasoning is not None else 'n/a'} |",
        f"| Total | {usage.total_tokens if usage else '?'} |",
        "",
        cost_line(model, usage.prompt_tokens, usage.completion_tokens) if usage else "",
        "",
        "## Reading",
        "",
    ]
    md += [parsed.reading, ""]
    md += [
        "## Prompts",
        "",
        "<details><summary>System prompt</summary>",
        "",
        "```",
        system_prompt,
        "```",
        "",
        "</details>",
        "",
        "<details><summary>User prompt</summary>",
        "",
        "```",
        user_prompt,
        "```",
        "",
        "</details>",
        "",
    ]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"lean_{slug}_{model}_{effort}.md"
    out_path.write_text("\n".join(md))
    return out_path


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default="gpt-5.4", help="OpenAI model (default: gpt-5.4)")
    parser.add_argument(
        "--effort",
        default=settings.openai_reasoning_effort,
        choices=get_args(ReasoningEffort),
        help="Reasoning effort",
    )
    parser.add_argument("--spread", choices=list(SPREADS), help="Run a single spread")
    args = parser.parse_args()

    if not settings.openai_api_key:
        raise SystemExit("OPENAI_API_KEY is not set")

    selected = {args.spread: SPREADS[args.spread]} if args.spread else SPREADS
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    try:
        for slug, request in selected.items():
            print(f"→ {slug}: {len(request.cards)} cards, {args.model} ({args.effort}) …")
            path = await run_spread(client, slug, request, args.model, args.effort)
            print(f"  wrote {path}")
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())
