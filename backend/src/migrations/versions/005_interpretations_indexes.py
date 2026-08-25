from motor.motor_asyncio import AsyncIOMotorDatabase

from src.database.collections.constants import INTERPRETATIONS_COLLECTION

version = "005"
description = "Create unique index on (reading_id, settings.lens) for interpretations collection"


async def up(db: AsyncIOMotorDatabase) -> None:
    await db[INTERPRETATIONS_COLLECTION].create_index(
        [("reading_id", 1), ("settings.lens", 1)], unique=True
    )
