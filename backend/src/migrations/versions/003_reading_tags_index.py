from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING

from src.database.collections.constants import READINGS_COLLECTION

version = "003"
description = "Create indexes for reading tag and spread_type search"


async def up(db: AsyncIOMotorDatabase) -> None:
    await db[READINGS_COLLECTION].create_index([("user_id", ASCENDING), ("tags", ASCENDING)])
    await db[READINGS_COLLECTION].create_index(
        [("user_id", ASCENDING), ("spread_type", ASCENDING), ("created_at", DESCENDING)]
    )
