from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING

from src.database.collections.constants import SPREAD_CARD_MEANINGS_COLLECTION

version = "017"
description = (
    "Introduce spread_card_meanings — one general meaning per card of the full deck, unique "
    "on its number (0..77, the frontend deck index). As with 016, the rows are upserted from "
    "the shipped JSON at every API start (src.cards.loader), not here."
)


async def up(db: AsyncIOMotorDatabase) -> None:
    # create_index with an identical spec is a no-op, which is what makes a re-run safe.
    await db[SPREAD_CARD_MEANINGS_COLLECTION].create_index(
        [("number", ASCENDING)], unique=True, name="number_unique"
    )
