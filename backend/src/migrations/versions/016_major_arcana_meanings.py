from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING

from src.database.collections.constants import MAJOR_ARCANA_MEANINGS_COLLECTION

version = "016"
description = (
    "Introduce major_arcana_meanings — one generated write-up per major arcana card, "
    "unique on its number (0..21, The Fool is 0). The rows themselves are upserted from "
    "the shipped JSON at every API start (src.cards.loader), not here: a migration runs "
    "once, and the text must follow each deploy."
)


async def up(db: AsyncIOMotorDatabase) -> None:
    # create_index with an identical spec is a no-op, which is what makes a re-run safe.
    await db[MAJOR_ARCANA_MEANINGS_COLLECTION].create_index(
        [("number", ASCENDING)], unique=True, name="number_unique"
    )
