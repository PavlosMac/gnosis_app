"""Generate the general meaning of each of the 78 cards, shown when a card in a spread is
clicked, with OpenAI.

    uv run python -m scripts.spread_card_meanings --dry-run --cards "Justice"   # show prompts
    uv run python -m scripts.spread_card_meanings --cards "Justice"             # one billed call
    uv run python -m scripts.spread_card_meanings                               # all missing cards
    uv run python -m scripts.spread_card_meanings --force --cards "Justice"     # regenerate

One plain-text call per card: the system prompt below and `Card: <name>.`, nothing else. The
model writes from its own knowledge of the Rider Waite deck; no source data is sent. Each
result is one piece of prose in two or three paragraphs, the same text whether the card fell
upright or reversed. It is written to src/lib/cards/spread_card_meanings.json (the committed
artifact) and mirrored to scripts/output/spread_card_meanings/<slug>.md (gitignored) for
reading. Cards already in the JSON are skipped unless --force, so a run resumes. A
regenerated card replaces its text; the model words a card differently every time.

This script does not write to Mongo: `src.cards.loader` seeds the collection from the JSON
at every API start, and on demand with `make card-meanings-load`. Reads OPENAI_API_KEY from
backend/.env through Settings.

Numbers and names follow the frontend deck (frontend/src/lib/cards.ts): majors 0..21, then
Pentacles from 22, Wands from 36, Cups from 50, Swords from 64; each suit runs Ace..Ten, Page,
Knight, Queen, King.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast, get_args

from openai import AsyncOpenAI

from scripts.major_arcana_meanings import (
    FRONTEND_NAMES,
    merge_entry,
    read_entries,
    select_cards,
    slug,
)
from src.cards.loader import SPREAD_CARDS
from src.core.config import ReasoningEffort, settings
from src.llm.pricing import cost_usd
from src.llm.prompt_builder import max_completion_tokens

ROOT = Path(__file__).resolve().parent.parent
MEANINGS_PATH = SPREAD_CARDS.path
OUT_DIR = ROOT / "scripts" / "output" / "spread_card_meanings"  # gitignored scratch

WORD_CAP = 300  # keep equal to the "max ... words" in SYSTEM_PROMPT
MIN_PARAGRAPHS = 2
MAX_PARAGRAPHS = 3

SUITS = ["Pentacles", "Wands", "Cups", "Swords"]  # frontend order: 22, 36, 50, 64
RANKS = [
    "Ace",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Page",
    "Knight",
    "Queen",
    "King",
]

SYSTEM_PROMPT = (
    "Sum up the meaning of this tarot card, using knowledge from the Rider Waite system. "
    "Do not mention Rider Waite, or any other deck, system or source, in the text. "
    "Include the card's difficult or shadow side as well as its positive side. "
    "Write it as one flowing piece of prose in two or three short paragraphs, with no "
    "subheadings or labels such as 'Upright' or 'Reversed'. "
    "Vary how the text opens; do not start with the phrase 'speaks of'. "
    f"Keep the content short, max {WORD_CAP} words."
)


# ---------------------------------------------------------------------------
# Pure parts (tested in tests/scripts/test_spread_card_meanings.py)
# ---------------------------------------------------------------------------


def deck_cards() -> list[dict[str, Any]]:
    """The 78 cards in frontend deck order, each as {number, name, slug}."""
    names = [*FRONTEND_NAMES, *(f"{rank} of {suit}" for suit in SUITS for rank in RANKS)]
    return [{"number": i, "name": name, "slug": slug(name)} for i, name in enumerate(names)]


def user_message(card: dict[str, Any]) -> str:
    return f"Card: {card['name']}."


def paragraphs(text: str) -> list[str]:
    return [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]


def text_warnings(text: str) -> list[str]:
    """What a human should look at before keeping this text. Empty when it follows the
    prompt. Never fatal: the text is still written, the run prints these."""
    warnings = []
    if re.search(r"rider|waite", text, re.IGNORECASE):
        warnings.append("names a source (Rider Waite)")
    if re.search(r"\*\*|^#", text, re.MULTILINE):
        warnings.append("contains markdown")
    if re.search(r"^[^.]*\bspeaks of\b", text):
        warnings.append("opens with 'speaks of'")
    count = len(paragraphs(text))
    if not MIN_PARAGRAPHS <= count <= MAX_PARAGRAPHS:
        warnings.append(f"{count} paragraph(s), expected {MIN_PARAGRAPHS} or {MAX_PARAGRAPHS}")
    if len(text.split()) > WORD_CAP:
        warnings.append(f"over the {WORD_CAP}-word cap")
    return warnings


def to_entry(
    card: dict[str, Any], text: str, model: str, effort: str, generated_at: str | None = None
) -> dict[str, Any]:
    meaning = "\n\n".join(paragraphs(text))
    return {
        "number": card["number"],
        "name": card["name"],
        "slug": card["slug"],
        "meaning": meaning,
        "word_count": len(meaning.split()),
        "model": model,
        "effort": effort,
        "generated_at": generated_at or datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


# ---------------------------------------------------------------------------
# I/O
# ---------------------------------------------------------------------------


def write_entries(path: Path, entries: list[dict[str, Any]]) -> None:
    data = {
        "_meta": {
            "source": (
                "generated by scripts/spread_card_meanings.py from the prompt alone "
                "(no source data); one general meaning per card, shown for a card in a spread"
            ),
            "number": "frontend deck index: 0 is The Fool, 21 The World, 22 Ace of Pentacles, "
            "36 Ace of Wands, 50 Ace of Cups, 64 Ace of Swords, 77 King of Swords",
        },
        "cards": entries,
    }
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def write_markdown(entry: dict[str, Any]) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{entry['slug']}.md"
    out.write_text(
        f"# {entry['name']} ({entry['number']})\n\n"
        f"_{entry['word_count']} words, {entry['model']}, effort {entry['effort']}_\n\n"
        f"{entry['meaning']}\n",
        encoding="utf-8",
    )
    return out


async def generate(
    client: AsyncOpenAI, card: dict[str, Any], model: str, effort: str
) -> tuple[str, str, int, int]:
    """One plain-text call; returns (text, resolved model, prompt tokens, completion tokens)."""
    response = await client.chat.completions.create(
        model=model,
        max_completion_tokens=max_completion_tokens(WORD_CAP, effort),
        reasoning_effort=cast(Any, effort),
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message(card)},
        ],
    )
    choice = response.choices[0]
    text = (choice.message.content or "").strip()
    if not text or choice.finish_reason != "stop":
        raise RuntimeError(f"{card['name']}: empty or cut-off response ({choice.finish_reason})")
    usage = response.usage
    prompt_tokens = usage.prompt_tokens if usage else 0
    completion_tokens = usage.completion_tokens if usage else 0
    return text, response.model, prompt_tokens, completion_tokens


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cards", nargs="+", help="only these cards, by frontend name")
    parser.add_argument("--force", action="store_true", help="regenerate cards already in the JSON")
    parser.add_argument("--model", default=settings.openai_model, help="default: from settings")
    parser.add_argument(
        "--effort",
        default=settings.openai_reasoning_effort,
        choices=get_args(ReasoningEffort),
        help="reasoning effort (default: from settings)",
    )
    parser.add_argument("--dry-run", action="store_true", help="print the prompts, call nothing")
    args = parser.parse_args()

    cards = select_cards(deck_cards(), args.cards)
    entries = read_entries(MEANINGS_PATH)
    existing = {e["number"] for e in entries}
    todo = [c for c in cards if args.force or c["number"] not in existing]

    if args.dry_run:
        print("=== system ===\n" + SYSTEM_PROMPT + "\n")
        for card in cards:
            state = "generate" if card in todo else "skip (in JSON)"
            print(f"=== user: {user_message(card)}  [{state}]")
        print(
            f"\n(dry run: {len(todo)} of {len(cards)} card(s) would be generated, "
            f"model {args.model}, effort {args.effort})"
        )
        return

    if not settings.openai_api_key:
        raise SystemExit("OPENAI_API_KEY is not set")

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    total_cost = 0.0
    try:
        for i, card in enumerate(cards, 1):
            if card not in todo:
                print(f"[{i}/{len(cards)}] skip {card['name']} (in JSON; --force to redo)")
                continue
            print(f"[{i}/{len(cards)}] {card['name']} ({args.model}, {args.effort}) …", flush=True)
            text, model, prompt_tokens, completion_tokens = await generate(
                client, card, args.model, args.effort
            )
            entry = to_entry(card, text, model, args.effort)
            entries = merge_entry(entries, entry)
            write_entries(MEANINGS_PATH, entries)
            out = write_markdown(entry)

            cost = cost_usd(prompt_tokens, completion_tokens, model)
            total_cost += cost
            print(
                f"  {entry['word_count']} words | in {prompt_tokens} out {completion_tokens} tok "
                f"| ${cost:.4f} (running ${total_cost:.4f}) | {out.relative_to(ROOT)}"
            )
            for warning in text_warnings(entry["meaning"]):
                print(f"  warning: {warning}", file=sys.stderr)
    finally:
        await client.close()

    print(
        f"\ndone: {len(entries)}/{len(deck_cards())} cards in "
        f"{MEANINGS_PATH.relative_to(ROOT)} | ${total_cost:.4f}"
    )


if __name__ == "__main__":
    asyncio.run(main())
