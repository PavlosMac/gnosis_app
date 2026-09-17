from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING

from src.database.collections.constants import READINGS_COLLECTION

version = "002"
description = "Create indexes for readings collection"


async def up(db: AsyncIOMotorDatabase) -> None:
    await db[READINGS_COLLECTION].create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
