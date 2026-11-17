"""Seed the card-meaning collections from the committed JSON files.

    uv run python -m src.cards.loader                 # or: make card-meanings-load
    .venv/bin/python -m src.cards.loader              # inside the production api container

Two sets, each a committed artifact generated once offline and never at runtime:
`major_arcana_meanings.json` (the card of the day, 22 cards) and
`spread_card_meanings.json` (a card clicked in a spread, 78 cards). This module lives under
`src/` because the production image copies only `src/`, so loading needs no OpenAI key.
Idempotent: every entry is upserted by `number`.
"""

import argparse
import asyncio
import json
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from src.core.config import settings
from src.database.collections.constants import (
    MAJOR_ARCANA_MEANINGS_COLLECTION,
    SPREAD_CARD_MEANINGS_COLLECTION,
)

_LIB = Path(__file__).resolve().parents[1] / "lib" / "cards"


@dataclass(frozen=True)
class MeaningSet:
    """One JSON file and the collection it seeds."""

    label: str  # used in error messages
    path: Path
    collection: str
    card_count: int  # `number` runs 0 .. card_count - 1 (the frontend deck index)
    text_fields: tuple[str, ...]  # must be present and non-empty on every entry


MAJOR_ARCANA = MeaningSet(
    label="major arcana meaning",
    path=_LIB / "major_arcana_meanings.json",
    collection=MAJOR_ARCANA_MEANINGS_COLLECTION,
    card_count=22,
    text_fields=("name", "upright", "shadow"),
)
SPREAD_CARDS = MeaningSet(
    label="spread card meaning",
    path=_LIB / "spread_card_meanings.json",
    collection=SPREAD_CARD_MEANINGS_COLLECTION,
    card_count=78,
    text_fields=("name", "meaning"),
)
MEANING_SETS = (MAJOR_ARCANA, SPREAD_CARDS)

MEANINGS_PATH = MAJOR_ARCANA.path


def _validate(entries: list[dict[str, Any]], spec: MeaningSet) -> None:
    """Refuse a malformed file up front: a bad entry would otherwise load fine and
    only fail as a 500 when that card is requested."""
    seen: set[int] = set()
    for entry in entries:
        number = entry.get("number")
        if (
            not isinstance(number, int)
            or isinstance(number, bool)
            or not 0 <= number < spec.card_count
        ):
            raise ValueError(f"{spec.label} has a bad number: {number!r}")
        if number in seen:
            raise ValueError(f"{spec.label} {number} appears twice")
        seen.add(number)
        for field in spec.text_fields:
            value = entry.get(field)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{spec.label} {number} has no {field}")


def read_meanings(
    path: Path | None = None, spec: MeaningSet = MAJOR_ARCANA
) -> list[dict[str, Any]]:
    path = path or spec.path
    if not path.exists():
        raise FileNotFoundError(f"{path} is missing — {spec.path.name} ships with the source tree")
    entries = json.loads(path.read_text(encoding="utf-8"))["cards"]
    _validate(entries, spec)
    return entries


async def upsert_meaning(
    db: AsyncIOMotorDatabase, entry: dict[str, Any], spec: MeaningSet = MAJOR_ARCANA
) -> None:
    document = {**entry, "updated_at": datetime.now(UTC)}
    await db[spec.collection].replace_one({"number": entry["number"]}, document, upsert=True)


async def load_meanings(
    db: AsyncIOMotorDatabase, path: Path | None = None, spec: MeaningSet = MAJOR_ARCANA
) -> int:
    entries = read_meanings(path, spec)
    for entry in entries:
        await upsert_meaning(db, entry, spec)
    return len(entries)


async def load_all_meanings(db: AsyncIOMotorDatabase) -> dict[str, int]:
    """Every set from its shipped file; returns {collection: entries upserted}."""
    return {spec.collection: await load_meanings(db, spec=spec) for spec in MEANING_SETS}


async def _main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mongo-uri", default=settings.mongodb_uri, help="default: MONGODB_URI from settings"
    )
    args = parser.parse_args()

    client: AsyncIOMotorClient = AsyncIOMotorClient(args.mongo_uri, serverSelectionTimeoutMS=5000)
    try:
        counts = await load_all_meanings(client[settings.mongodb_database])
    finally:
        client.close()
    for spec in MEANING_SETS:
        count = counts[spec.collection]
        print(f"upserted {count} {spec.label}s into {settings.mongodb_database}")
        if count < spec.card_count:
            print(
                f"WARNING: only {count} of {spec.card_count} cards are in {spec.path.name}",
                file=sys.stderr,
            )


if __name__ == "__main__":
    try:
        asyncio.run(_main())
    except (FileNotFoundError, ValueError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
