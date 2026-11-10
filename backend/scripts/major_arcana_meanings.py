"""Generate the card-of-the-day write-ups for the 22 major arcana with OpenAI.

    uv run python -m scripts.major_arcana_meanings --dry-run --cards "The Fool"   # show prompts
    uv run python -m scripts.major_arcana_meanings --cards "The Fool"             # one billed call
    uv run python -m scripts.major_arcana_meanings                                # all 22
    uv run python -m scripts.major_arcana_meanings --force --cards "The Fool"     # regenerate

Source: the Tsarion metadata in src/lib/cards/major_arcana.json. For each card one
structured-output call returns two paragraphs (the day upright, and its shadow), at most
WORD_CAP words in all; there is no reversed reading for a card of the day. Each result is
written to src/lib/cards/major_arcana_meanings.json (the committed artifact
`src.cards.loader` seeds Mongo from), mirrored to
scripts/output/major_arcana_meanings/<slug>.md (gitignored) for reading, and upserted into
the local Mongo straight away. Cards already in the JSON are skipped unless --force, so a
run resumes. Reads OPENAI_API_KEY and MONGODB_URI from backend/.env through Settings; the
compose hostname `mongodb` is rewritten to localhost.

Numbers and names follow the frontend deck (frontend/src/lib/cards.ts): The Fool is 0,
"Judgement", "The World".
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

from motor.motor_asyncio import AsyncIOMotorClient
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from src.cards.loader import MEANINGS_PATH, upsert_meaning
from src.core.config import ReasoningEffort, settings
from src.llm.pricing import cost_usd
from src.llm.prompt_builder import max_completion_tokens

ROOT = Path(__file__).resolve().parent.parent
SOURCE_PATH = ROOT / "src" / "lib" / "cards" / "major_arcana.json"
OUT_DIR = ROOT / "scripts" / "output" / "major_arcana_meanings"  # gitignored scratch

WORD_CAP = 140
WORD_FLOOR = 110
WORDS_PER_PARAGRAPH = 60

# Tsarion -> frontend. The frontend deck is what readings store and what the profile
# looks a card up by, so the stored identity is the frontend's.
FOOL_SOURCE_NUMBER = 22
NAME_ALIASES = {"Judgment": "Judgement", "Universe": "The World"}

FRONTEND_NAMES = [
    "The Fool",
    "The Magician",
    "The High Priestess",
    "The Empress",
    "The Emperor",
    "The Hierophant",
    "The Lovers",
    "The Chariot",
    "Strength",
    "The Hermit",
    "Wheel of Fortune",
    "Justice",
    "The Hanged Man",
    "Death",
    "Temperance",
    "The Devil",
    "The Tower",
    "The Star",
    "The Moon",
    "The Sun",
    "Judgement",
    "The World",
]


class MajorArcanaMeaning(BaseModel):
    """Structured output sent to OpenAI as response_format."""

    upright: str = Field(
        ...,
        description=(
            f"Paragraph one, about {WORDS_PER_PARAGRAPH} words: the card upright at its best, "
            "what it opens, offers or asks of the one who drew it today."
        ),
    )
    shadow: str = Field(
        ...,
        description=(
            f"Paragraph two, about {WORDS_PER_PARAGRAPH} words: the same day energy overplayed "
            "or ill-dignified, drawn from the upright negative meanings, with advice."
        ),
    )


SYSTEM_PROMPT = """\
You are a tarot and numerology expert writing for a person who has drawn this card as their card of the day.
You are given the card's metadata: keywords, archetype, astrological and esoteric \
correspondences, numerology, and lists of its upright positive and upright negative. 
The keywords are the backbone of what you write; the correspondences \
are its colour.  Describe what the card could mean as a card of the day for 
the user, e.g. is it an active or a passive day, is the energy extroverted or introverted, 
is it a day for action or resting, is it time to start a project or wait. 
Give advice on what the card could mean for the users day. 
Keep the focus on what the card means for the day. Max word count 200 words.
"""


# ---------------------------------------------------------------------------
# Pure parts (tested in tests/scripts/test_major_arcana_meanings.py)
# ---------------------------------------------------------------------------


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def frontend_identity(source: dict[str, Any]) -> tuple[int, str, str]:
    """(number, name, slug) as the frontend deck knows the card."""
    number = 0 if source["number"] == FOOL_SOURCE_NUMBER else int(source["number"])
    raw_name = str(source["name"])
    name = NAME_ALIASES.get(raw_name, raw_name)
    return number, name, slug(name)


def load_source_cards(path: Path = SOURCE_PATH) -> list[dict[str, Any]]:
    """The 22 Tsarion cards in frontend order, each as
    {number, name, slug, source: <the raw JSON entry>}."""
    raw = json.loads(path.read_text(encoding="utf-8"))["major_arcana"]
    cards = []
    for source in raw:
        number, name, card_slug = frontend_identity(source)
        cards.append({"number": number, "name": name, "slug": card_slug, "source": source})
    cards.sort(key=lambda c: c["number"])
    return cards


def select_cards(cards: list[dict[str, Any]], names: list[str] | None) -> list[dict[str, Any]]:
    if not names:
        return cards
    known = {c["name"].lower() for c in cards}
    if unknown := [n for n in names if n.lower() not in known]:
        sys.exit(f"unknown cards: {', '.join(unknown)} (use the frontend names)")
    wanted = {n.lower() for n in names}
    return [c for c in cards if c["name"].lower() in wanted]


def card_context(card: dict[str, Any]) -> dict[str, Any]:
    """What the model sees: the frontend name, the card's traditional number (The Fool
    is 22 here, as in its numerology block, not the deck index 0), the metadata, and the
    meaning lists."""
    source = card["source"]
    return {
        "name": card["name"],
        "number": source["number"],
        "meta": source["meta"],
        "upright": source["upright"],
    }


def user_message(card: dict[str, Any]) -> str:
    return (
        f"Card: {card['name']}. Write its two paragraphs (upright, shadow): between "
        f"{WORD_FLOOR} and {WORD_CAP} words in all, so use the room. Treat the keywords as the "
        "backbone of the text.\n\n"
        f"Card data:\n```json\n{json.dumps(card_context(card), indent=1, ensure_ascii=False)}\n```"
    )


def to_entry(
    card: dict[str, Any], parsed: MajorArcanaMeaning, model: str, effort: str
) -> dict[str, Any]:
    paragraphs = [parsed.upright.strip(), parsed.shadow.strip()]
    return {
        "number": card["number"],
        "name": card["name"],
        "slug": card["slug"],
        "upright": paragraphs[0],
        "shadow": paragraphs[1],
        "word_count": sum(len(p.split()) for p in paragraphs),
        "model": model,
        "effort": effort,
        "generated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def merge_entry(entries: list[dict[str, Any]], entry: dict[str, Any]) -> list[dict[str, Any]]:
    kept = [e for e in entries if e["number"] != entry["number"]]
    return sorted([*kept, entry], key=lambda e: e["number"])


def host_mongo_uri(uri: str) -> str:
    """`.env` is shared with the compose `api` service, so it may name Mongo by its service
    hostname (`mongodb`), which does not resolve from the host. The compose file publishes
    the same port on localhost, so rewriting the host is enough."""
    return re.sub(r"(//(?:[^@/]*@)?)mongodb(?=[:/]|$)", r"\1localhost", uri, count=1)


# ---------------------------------------------------------------------------
# I/O
# ---------------------------------------------------------------------------


def read_entries(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))["cards"]


def write_entries(path: Path, entries: list[dict[str, Any]]) -> None:
    data = {
        "_meta": {
            "source": (
                "generated by scripts/major_arcana_meanings.py from src/lib/cards/"
                "major_arcana.json (Tsarion metadata); seeded into Mongo by src.cards.loader"
            ),
            "number": "frontend deck index: 0 is The Fool, 21 is The World",
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
        f"{entry['upright']}\n\n{entry['shadow']}\n",
        encoding="utf-8",
    )
    return out


async def generate(
    client: AsyncOpenAI, card: dict[str, Any], model: str, effort: str
) -> tuple[MajorArcanaMeaning, str, int, int]:
    """One structured-output call; returns (parsed, resolved model, prompt tokens,
    completion tokens)."""
    response = await client.beta.chat.completions.parse(
        model=model,
        max_completion_tokens=max_completion_tokens(WORD_CAP, effort),
        reasoning_effort=cast(Any, effort),
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message(card)},
        ],
        response_format=MajorArcanaMeaning,
    )
    parsed = response.choices[0].message.parsed
    if parsed is None:
        raise RuntimeError(f"{card['name']}: empty or unparseable response")
    usage = response.usage
    prompt_tokens = usage.prompt_tokens if usage else 0
    completion_tokens = usage.completion_tokens if usage else 0
    return parsed, response.model, prompt_tokens, completion_tokens


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
    parser.add_argument(
        "--mongo-uri",
        default=host_mongo_uri(settings.mongodb_uri),
        help="default: MONGODB_URI from settings with the compose host rewritten to localhost",
    )
    args = parser.parse_args()

    cards = select_cards(load_source_cards(), args.cards)

    if args.dry_run:
        print("=== system ===\n" + SYSTEM_PROMPT)
        for card in cards:
            print(f"=== user: {card['name']} ===\n" + user_message(card) + "\n")
        print(f"(dry run: {len(cards)} card(s), model {args.model}, effort {args.effort})")
        return

    if not settings.openai_api_key:
        raise SystemExit("OPENAI_API_KEY is not set")

    entries = read_entries(MEANINGS_PATH)
    existing = {e["number"] for e in entries}

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    mongo: AsyncIOMotorClient = AsyncIOMotorClient(args.mongo_uri, serverSelectionTimeoutMS=5000)
    db = mongo[settings.mongodb_database]
    total_cost = 0.0
    try:
        for i, card in enumerate(cards, 1):
            if card["number"] in existing and not args.force:
                print(f"[{i}/{len(cards)}] skip {card['name']} (in JSON; --force to redo)")
                continue
            print(f"[{i}/{len(cards)}] {card['name']} ({args.model}, {args.effort}) …", flush=True)
            parsed, model, prompt_tokens, completion_tokens = await generate(
                client, card, args.model, args.effort
            )
            entry = to_entry(card, parsed, model, args.effort)
            entries = merge_entry(entries, entry)
            write_entries(MEANINGS_PATH, entries)
            out = write_markdown(entry)
            await upsert_meaning(db, entry)

            cost = cost_usd(prompt_tokens, completion_tokens, model)
            total_cost += cost
            print(
                f"  {entry['word_count']} words | in {prompt_tokens} out {completion_tokens} tok "
                f"| ${cost:.4f} (running ${total_cost:.4f}) | {out.relative_to(ROOT)}"
            )
            if entry["word_count"] > WORD_CAP:
                print(f"  warning: over the {WORD_CAP}-word cap", file=sys.stderr)
    finally:
        await client.close()
        mongo.close()

    print(
        f"\ndone: {len(entries)}/22 cards in {MEANINGS_PATH.relative_to(ROOT)} | ${total_cost:.4f}"
    )


if __name__ == "__main__":
    asyncio.run(main())
