from motor.motor_asyncio import AsyncIOMotorDatabase

from src.database.collections.constants import INTERPRETATIONS_COLLECTION

version = "005"
description = "Create unique index on reading_id for interpretations collection"


async def up(db: AsyncIOMotorDatabase) -> None:
    await db[INTERPRETATIONS_COLLECTION].create_index("reading_id", unique=True)
