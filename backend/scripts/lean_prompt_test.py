"""Experiment harness for the lean prompt architecture — now wired to the production
builder in `src/llm/prompt_builder.py`.

Sends only the spread structure (question, positions, orientations, position
descriptions) plus the compact system prompt, and lets the model interpret from its
own knowledge of tarot. Writes each reading to a .md file for judging, with token
usage and cost.

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

from src.core.config import ReasoningEffort, settings
from src.llm.pricing import cost_usd
from src.llm.prompt_builder import (
    build_system_prompt,
    build_user_prompt,
    max_completion_tokens,
    request_word_budget,
)
from src.llm.schemas import (
    CardInSpread,
    InterpretationRequest,
    LeanReading,
    Orientation,
)

OUT_DIR = Path("docs/prompts/experiments")


# ---------------------------------------------------------------------------
# Test spreads
# ---------------------------------------------------------------------------

SPREADS: dict[str, InterpretationRequest] = {
    # Mirrors the SAMPLE_REQUEST in docs/prompts/prompt_reference.md for a direct
    # comparison on content and tokens.
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
    ),
}


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------


async def run_spread(
    client: AsyncOpenAI, slug: str, request: InterpretationRequest, model: str, effort: str
) -> Path:
    system_prompt = build_system_prompt(request)
    user_prompt = build_user_prompt(request)
    completion_cap = max_completion_tokens(request_word_budget(request), effort)

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

    md: list[str] = [
        f"# Lean prompt test — {request.spread_name}",
        "",
        f"_Generated {datetime.now(UTC).strftime('%Y-%m-%d %H:%M UTC')}_",
        "",
        f"- **Model:** {response.model} (reasoning effort: {effort})",
        f"- **Question:** {request.question}",
        f"- **Budget:** ~{request_word_budget(request)} words",
        "",
        "## Token cost",
        "",
        "| | tokens |",
        "|---|---|",
        f"| Input | {usage.prompt_tokens if usage else '?'} |",
        f"| Output | {usage.completion_tokens if usage else '?'} |",
        f"| — of which reasoning | {reasoning if reasoning is not None else 'n/a'} |",
        f"| Total | {usage.total_tokens if usage else '?'} |",
        "",
        (
            "**Cost:** "
            f"${cost_usd(usage.prompt_tokens, usage.completion_tokens, response.model):.5f}"
            if usage
            else ""
        ),
        "",
        "## Reading",
        "",
        parsed.reading,
        "",
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
    parser.add_argument(
        "--model", default=settings.openai_model, help="OpenAI model (default: from settings)"
    )
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
