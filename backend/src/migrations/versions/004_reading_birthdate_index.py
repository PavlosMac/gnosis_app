from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING

from src.database.collections.constants import READINGS_COLLECTION

version = "004"
description = "Create index for birth_date search scoped to spread_type"


async def up(db: AsyncIOMotorDatabase) -> None:
    await db[READINGS_COLLECTION].create_index(
        [("user_id", ASCENDING), ("spread_type", ASCENDING), ("birth_date", ASCENDING)]
    )
