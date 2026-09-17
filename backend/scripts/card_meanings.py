"""Generate poetic write-ups for every card in src/lib/cards using Claude.

Usage:
    uv run python scripts/card_meanings.py --sample          # one pip per suit (4 cards)
    uv run python scripts/card_meanings.py                   # all 78 cards
    uv run python scripts/card_meanings.py --effort low      # override effort (default: high)
    uv run python scripts/card_meanings.py --force           # overwrite existing output

Reads ANTHROPIC_API_KEY from the environment / .env. Each card is written to
src/lib/cards/card_meanings/<tier file>.json (the production artifact) and mirrored as
docs/cards/<tier>/<slug>.md. Cards already present in the JSON are skipped, so a re-run
resumes where it left off.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

import anthropic
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
CARDS_DIR = ROOT / "src" / "lib" / "cards"
MEANINGS_DIR = CARDS_DIR / "card_meanings"
OUT_DIR = ROOT / "docs" / "cards"

MEANINGS_FILES = {
    "major": "major_arcana.json",
    "minor": "minor_arcana.json",
    "court": "court_royals.json",
}

Effort = Literal["low", "medium", "high"]

MODEL = "claude-opus-5"
INPUT_PRICE = 5.00 / 1_000_000
OUTPUT_PRICE = 25.00 / 1_000_000

# Comparison experiment: same prompt against Gemini. Writes docs/cards/<tier>/<slug>.gemini.md
# only — never the production JSON in src/lib/cards/card_meanings/.
GEMINI_MODEL = "gemini-3.1-pro-preview"
GEMINI_INPUT_PRICE = 2.00 / 1_000_000
GEMINI_OUTPUT_PRICE = 12.00 / 1_000_000  # thinking tokens bill as output

# tier -> (word cap, max_tokens backstop)
# Backstops leave room for adaptive thinking tokens, which count against max_tokens.
TIERS = {"major": (500, 4000), "minor": (300, 3000), "court": (200, 2500)}

SYSTEM_PROMPT = """\
You write informative, poetic texts about tarot cards for a human reader.

You are given a card's structured metadata (correspondences, keyword lists, upright / \
reversed / negative meanings). Turn it into flowing prose — not a list, not headings, no \
restating of the raw data. Consider both the positive and negative aspects of the card. Draw on \
astrology, alchemy, numerology and myth from the metadata for metaphoric language.

Style:
- Enter each card through an image or a scene — something seen, felt, or remembered — never \
through a declaration or a definition of terms.
- Write in longer, flowing sentences that carry the reader forward; let clauses build and \
resolve naturally. Do not stack short fragments for effect.
- No aphoristic one-liners as openers or closers, no epigrams, no clever-sounding paradox \
declarations ("X is not Y", "X is both A and B at once"). If a sentence sounds like it wants \
to be quoted, rewrite it so it wants to be read. End on a full flowing sentence, not a \
staccato punchline.
- Elegant and human over striking: metaphors should feel inevitable rather than performed. \
Prefer warmth and clarity to cleverness.
- Name the reversed card plainly: introduce that passage with the word "reversed" \
(e.g. "Reversed, ..."). Never euphemisms like "turned over", "inverted", "upside down".
- Keep the vocabulary in nature, myth, craft, weather, and human life. Never engineering, \
programming, or corporate language — no "load-bearing", "ground wire", "bandwidth", \
"recalibrate", "system" and the like.
- This write-up is one of 78, read alongside the others: give this card an entry image native \
to its own correspondences, and avoid formulaic scene templates such as a figure standing at \
a vantage point ("Someone stands...").
- Keep the esoteric material traceable: weave the kabbalah paths, alchemical stages, mythic \
figures, numerology and astrology from the metadata into the prose so a knowledgeable reader \
can recognise them — but fold them into the sentences, never announce them as items.

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
    """One pip per suit (2..10 rotating): 4 cards."""
    picked: list[tuple[str, dict[str, Any]]] = []
    seen_suit_pip: set[str] = set()
    for tier, card in cards:
        suit = str(card.get("suit", ""))
        want_pip = tier == "minor" and card["number"] == 2 + len(seen_suit_pip)
        if want_pip and suit not in seen_suit_pip:
            picked.append((tier, card))
            seen_suit_pip.add(suit)
    return picked


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def load_meanings(tier: str) -> dict[str, Any]:
    path = MEANINGS_DIR / MEANINGS_FILES[tier]
    if not path.exists() or path.stat().st_size == 0:
        return {
            "_meta": {
                "tier": tier,
                "source": "generated by scripts/card_meanings.py from src/lib/cards metadata",
            },
            "cards": {},
        }
    return json.loads(path.read_text(encoding="utf-8"))


def save_meanings(tier: str, data: dict[str, Any]) -> None:
    path = MEANINGS_DIR / MEANINGS_FILES[tier]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def strip_h1(text: str) -> str:
    """Drop the leading '# <Name>' line for the JSON meaning field."""
    lines = text.split("\n")
    if lines and lines[0].lstrip().startswith("#"):
        lines = lines[1:]
    return "\n".join(lines).strip()


def opening_line(meaning: str) -> str:
    """First ~15 words of a write-up, for the do-not-echo list."""
    first = meaning.split("\n")[0]
    words = first.split()
    return " ".join(words[:15]) + ("..." if len(words) > 15 else "")


def user_message(tier: str, card: dict[str, Any], openings: list[str]) -> str:
    words, _ = TIERS[tier]
    msg = (
        f"Tier: {tier} arcana. Word cap: {words}.\n\n"
        f"Card data:\n```json\n{json.dumps(card, indent=1, ensure_ascii=False)}\n```"
    )
    if openings:
        listed = "\n".join(f"- {o}" for o in openings[-20:])
        msg += (
            "\n\nOpenings already used by other cards — do not echo their imagery "
            f"or structure:\n{listed}"
        )
    return msg


def generate(
    client: anthropic.Anthropic,
    tier: str,
    card: dict[str, Any],
    effort: Effort,
    openings: list[str],
) -> tuple[str, anthropic.types.Usage]:
    _, max_tokens = TIERS[tier]
    response = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        output_config={"effort": effort},
        messages=[{"role": "user", "content": user_message(tier, card, openings)}],
    )
    if response.stop_reason == "refusal":
        raise RuntimeError(f"refused: {response.stop_details}")
    if response.stop_reason == "max_tokens":
        print(f"  warning: hit max_tokens ({max_tokens}), output may be cut", file=sys.stderr)
    text = "".join(b.text for b in response.content if b.type == "text").strip()
    return text, response.usage


def generate_gemini(
    client: Any, model: str, tier: str, card: dict[str, Any], effort: Effort, openings: list[str]
) -> tuple[str, Any]:
    from google.genai import types

    _, max_tokens = TIERS[tier]
    response = client.models.generate_content(
        model=model,
        contents=user_message(tier, card, openings),
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            max_output_tokens=max_tokens,
            thinking_config=types.ThinkingConfig(thinking_level=effort),
        ),
    )
    finish = response.candidates[0].finish_reason if response.candidates else None
    if finish and finish.name == "MAX_TOKENS":
        print(f"  warning: hit max_tokens ({max_tokens}), output may be cut", file=sys.stderr)
    text = (response.text or "").strip()
    if not text:
        raise RuntimeError(f"empty response (finish_reason={finish})")
    return text, response.usage_metadata


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample", action="store_true", help="one pip per suit (4 cards)")
    parser.add_argument("--cards", nargs="+", help="generate only these cards (by name)")
    parser.add_argument("--effort", default="high", choices=["low", "medium", "high"])
    parser.add_argument("--force", action="store_true", help="overwrite existing output files")
    parser.add_argument(
        "--provider",
        default="anthropic",
        choices=["anthropic", "gemini"],
        help="gemini writes comparison files (<slug>.gemini.md) only, not the production JSON",
    )
    parser.add_argument(
        "--gemini-model",
        default=GEMINI_MODEL,
        help="e.g. gemini-3-flash-preview (free tier) or gemini-3.1-pro-preview (needs billing)",
    )
    args = parser.parse_args()

    load_dotenv(ROOT / ".env")
    if args.provider == "gemini":
        if not os.environ.get("GEMINI_API_KEY"):
            sys.exit("GEMINI_API_KEY not set (put it in .env)")
        from google import genai

        client: Any = genai.Client()
    else:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            sys.exit("ANTHROPIC_API_KEY not set (put it in .env)")
        client = anthropic.Anthropic()

    cards = load_cards()
    if args.sample:
        cards = sample(cards)
    if args.cards:
        wanted = {name.lower() for name in args.cards}
        cards = [(tier, card) for tier, card in cards if card["name"].lower() in wanted]
        found = {card["name"].lower() for _, card in cards}
        if missing := wanted - found:
            sys.exit(f"unknown cards: {', '.join(sorted(missing))}")

    meanings = {tier: load_meanings(tier) for tier in MEANINGS_FILES}

    # Openings of cards kept from earlier runs, so new write-ups don't echo their imagery.
    # Cards regenerated in this run are excluded — their old openings are being replaced.
    regenerating = {card["name"] for _, card in cards} if args.force else set()
    openings = [
        opening_line(entry["meaning"])
        for data in meanings.values()
        for name, entry in data["cards"].items()
        if name not in regenerating
    ]

    total_in = total_out = total_cache_read = 0
    cost = 0.0
    for i, (tier, card) in enumerate(cards, 1):
        name = card["name"]

        if args.provider == "gemini":
            out = OUT_DIR / tier / f"{slug(name)}.gemini.md"
            if out.exists() and not args.force:
                print(f"[{i}/{len(cards)}] skip {name} (exists)")
                continue
            print(f"[{i}/{len(cards)}] {tier:5} {name}", flush=True)
            text, usage = generate_gemini(
                client, args.gemini_model, tier, card, args.effort, openings
            )
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(text + "\n")
            in_tok = usage.prompt_token_count or 0
            out_tok = (usage.candidates_token_count or 0) + (usage.thoughts_token_count or 0)
            total_in += in_tok
            total_out += out_tok
            cost += in_tok * GEMINI_INPUT_PRICE + out_tok * GEMINI_OUTPUT_PRICE
            print(f"  {len(text.split())} words | out {out_tok} tok | running ${cost:.3f}")
            continue

        if name in meanings[tier]["cards"] and not args.force:
            print(f"[{i}/{len(cards)}] skip {name} (exists)")
            continue
        print(f"[{i}/{len(cards)}] {tier:5} {name}", flush=True)
        text, usage = generate(client, tier, card, args.effort, openings)

        out = OUT_DIR / tier / f"{slug(name)}.md"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text + "\n")

        meaning = strip_h1(text)
        meanings[tier]["cards"][name] = {
            "slug": slug(name),
            "meaning": meaning,
            "word_count": len(meaning.split()),
            "model": MODEL,
            "effort": args.effort,
            "generated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        save_meanings(tier, meanings[tier])
        openings.append(opening_line(meaning))

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
