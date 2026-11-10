"""Seed `major_arcana_meanings` from the committed JSON.

    uv run python -m src.cards.loader                 # or: make card-meanings-load
    .venv/bin/python -m src.cards.loader              # inside the production api container

The JSON (`src/lib/cards/major_arcana_meanings.json`) is a committed artifact: it was
generated once offline and is not regenerated at runtime. This module lives under `src/`
because the production image copies only `src/`, so loading it needs no OpenAI key.
Idempotent: every entry is upserted by `number`.
"""

import argparse
import asyncio
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from src.core.config import settings
from src.database.collections.constants import MAJOR_ARCANA_MEANINGS_COLLECTION

MEANINGS_PATH = Path(__file__).resolve().parents[1] / "lib" / "cards" / "major_arcana_meanings.json"


_REQUIRED_TEXT_FIELDS = ("name", "upright", "shadow")
_CARD_COUNT = 22


def _validate(entries: list[dict[str, Any]]) -> None:
    """Refuse a malformed file up front: a bad entry would otherwise load fine and
    only fail as a 500 when that card is requested."""
    seen: set[int] = set()
    for entry in entries:
        number = entry.get("number")
        if not isinstance(number, int) or isinstance(number, bool) or not 0 <= number < _CARD_COUNT:
            raise ValueError(f"major arcana meaning has a bad number: {number!r}")
        if number in seen:
            raise ValueError(f"major arcana meaning {number} appears twice")
        seen.add(number)
        for field in _REQUIRED_TEXT_FIELDS:
            value = entry.get(field)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"major arcana meaning {number} has no {field}")


def read_meanings(path: Path = MEANINGS_PATH) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(
            f"{path} is missing — major_arcana_meanings.json ships with the source tree"
        )
    entries = json.loads(path.read_text(encoding="utf-8"))["cards"]
    _validate(entries)
    return entries


async def upsert_meaning(db: AsyncIOMotorDatabase, entry: dict[str, Any]) -> None:
    document = {**entry, "updated_at": datetime.now(UTC)}
    await db[MAJOR_ARCANA_MEANINGS_COLLECTION].replace_one(
        {"number": entry["number"]}, document, upsert=True
    )


async def load_meanings(db: AsyncIOMotorDatabase, path: Path = MEANINGS_PATH) -> int:
    entries = read_meanings(path)
    for entry in entries:
        await upsert_meaning(db, entry)
    return len(entries)


async def _main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mongo-uri", default=settings.mongodb_uri, help="default: MONGODB_URI from settings"
    )
    args = parser.parse_args()

    client: AsyncIOMotorClient = AsyncIOMotorClient(args.mongo_uri, serverSelectionTimeoutMS=5000)
    try:
        count = await load_meanings(client[settings.mongodb_database])
    finally:
        client.close()
    print(f"upserted {count} major arcana meanings into {settings.mongodb_database}")
    if count < _CARD_COUNT:
        print(f"WARNING: only {count} of {_CARD_COUNT} cards are in the file", file=sys.stderr)


if __name__ == "__main__":
    try:
        asyncio.run(_main())
    except (FileNotFoundError, ValueError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
