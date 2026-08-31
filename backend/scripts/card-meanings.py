"""Generate poetic write-ups for every card in src/lib/cards using Claude.
s
Usage:
    uv run python scripts/card-meanings.py --sample          # The Fool + 1 pip + 1 court per suit
    uv run python scripts/card-meanings.py                   # all 78 cards
    uv run python scripts/card-meanings.py --effort low      # override effort (default: medium)
    uv run python scripts/card-meanings.py --force           # overwrite existing files

Reads ANTHROPIC_API_KEY from the environment / .env. Output goes to docs/cards/<tier>/<slug>.md.
Existing files are skipped, so a re-run resumes where it left off.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Literal

import anthropic
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
CARDS_DIR = ROOT / "src" / "lib" / "cards"
OUT_DIR = ROOT / "docs" / "cards"

Effort = Literal["low", "medium", "high"]

MODEL = "claude-opus-5"
INPUT_PRICE = 5.00 / 1_000_000
OUTPUT_PRICE = 25.00 / 1_000_000

# tier -> (word cap, max_tokens backstop)
TIERS = {"major": (500, 1400), "minor": (300, 900), "court": (200, 700)}

SYSTEM_PROMPT = """\
You write informative, poetic texts about tarot cards for a human reader.

You are given a card's structured metadata (correspondences, keyword lists, upright / \
reversed / negative meanings). Turn it into flowing prose — not a list, not headings, no \
restating of the raw data. Consider both the positive and negative aspects of the card. Draw on \
astrology, alchemy, numerology and myth from the metadata for metaphoric language.

Tier guidance:
- Major arcana: the energy is archetypal and less practical. Max 500 words.
- Minor arcana (pips): alchemical, related to the four spheres of being — energetic (wands), \
thought/mind (swords), material/money (disks), emotion (cups). The suit description is \
provided. Max 300 words.
- Court cards: modes of character, or actual people in our lives. Max 200 words.

Output only the write-up. Begin with the card's name as a markdown H1 line, then the prose.
"""


def load_cards() -> list[tuple[str, dict[str, Any]]]:
    major = json.loads((CARDS_DIR / "major_arcana.json").read_text())["major_arcana"]
    minor = json.loads((CARDS_DIR / "minor_arcana.json").read_text())["suits"]
    court = json.loads((CARDS_DIR / "court_royals.json").read_text())["suits"]
    suits = json.loads((CARDS_DIR / "suits.json").read_text())["suits"]

    cards: list[tuple[str, dict[str, Any]]] = [("major", c) for c in major]
    for suit, pips in minor.items():
        for c in pips:
            cards.append(("minor", {**c, "suit_context": suits[suit]}))
    for suit, royals in court.items():
        for c in royals:
            cards.append(("court", {**c, "suit": suit, "suit_context": suits[suit]}))
    return cards


def sample(cards: list[tuple[str, dict[str, Any]]]) -> list[tuple[str, dict[str, Any]]]:
    """The Fool, one pip per suit (2..10 rotating), one court per suit."""
    picked = [next(c for c in cards if c[0] == "major")]
    seen_suit_pip: set[str] = set()
    seen_suit_court: set[str] = set()
    for tier, card in cards:
        suit = str(card.get("suit", ""))
        want_pip = tier == "minor" and card["number"] == 2 + len(seen_suit_pip)
        if want_pip and suit not in seen_suit_pip:
            picked.append((tier, card))
            seen_suit_pip.add(suit)
        elif tier == "court" and suit not in seen_suit_court:
            picked.append((tier, card))
            seen_suit_court.add(suit)
    return picked


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def user_message(tier: str, card: dict[str, Any]) -> str:
    words, _ = TIERS[tier]
    return (
        f"Tier: {tier} arcana. Word cap: {words}.\n\n"
        f"Card data:\n```json\n{json.dumps(card, indent=1, ensure_ascii=False)}\n```"
    )


def generate(
    client: anthropic.Anthropic, tier: str, card: dict[str, Any], effort: Effort
) -> tuple[str, anthropic.types.Usage]:
    _, max_tokens = TIERS[tier]
    response = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        output_config={"effort": effort},
        messages=[{"role": "user", "content": user_message(tier, card)}],
    )
    if response.stop_reason == "refusal":
        raise RuntimeError(f"refused: {response.stop_details}")
    if response.stop_reason == "max_tokens":
        print(f"  warning: hit max_tokens ({max_tokens}), output may be cut", file=sys.stderr)
    text = "".join(b.text for b in response.content if b.type == "text").strip()
    return text, response.usage


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample", action="store_true", help="The Fool + 1 pip + 1 court per suit")
    parser.add_argument("--effort", default="medium", choices=["low", "medium", "high"])
    parser.add_argument("--force", action="store_true", help="overwrite existing output files")
    args = parser.parse_args()

    load_dotenv(ROOT / ".env")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("ANTHROPIC_API_KEY not set (put it in .env)")
    client = anthropic.Anthropic()

    cards = load_cards()
    if args.sample:
        cards = sample(cards)

    total_in = total_out = total_cache_read = 0
    cost = 0.0
    for i, (tier, card) in enumerate(cards, 1):
        out = OUT_DIR / tier / f"{slug(card['name'])}.md"
        if out.exists() and not args.force:
            print(f"[{i}/{len(cards)}] skip {card['name']} (exists)")
            continue
        print(f"[{i}/{len(cards)}] {tier:5} {card['name']}", flush=True)
        text, usage = generate(client, tier, card, args.effort)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text + "\n")

        cache_read = usage.cache_read_input_tokens or 0
        cache_write = usage.cache_creation_input_tokens or 0
        total_in += usage.input_tokens + cache_write
        total_cache_read += cache_read
        total_out += usage.output_tokens
        cost += (
            usage.input_tokens * INPUT_PRICE
            + cache_write * INPUT_PRICE * 1.25
            + cache_read * INPUT_PRICE * 0.1
            + usage.output_tokens * OUTPUT_PRICE
        )
        print(f"  {len(text.split())} words | out {usage.output_tokens} tok | running ${cost:.3f}")

    print(
        f"\ndone: input {total_in} (+{total_cache_read} cached) | output {total_out} "
        f"| est. cost ${cost:.3f} | effort={args.effort}"
    )


if __name__ == "__main__":
    main()
