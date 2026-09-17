from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING

from src.database.collections.constants import REFRESH_TOKENS_COLLECTION, USERS_COLLECTION

version = "001"
description = "Create initial indexes for users and refresh_tokens"


async def up(db: AsyncIOMotorDatabase) -> None:
    await db[USERS_COLLECTION].create_index("email", unique=True)
    await db[USERS_COLLECTION].create_index("stripe_customer_id", unique=True, sparse=True)
    await db[USERS_COLLECTION].create_index([("created_at", -1)])
    await db[REFRESH_TOKENS_COLLECTION].create_index("jti", unique=True)
    await db[REFRESH_TOKENS_COLLECTION].create_index("family_id")
    await db[REFRESH_TOKENS_COLLECTION].create_index(
        [("expires_at", ASCENDING)], expireAfterSeconds=0
    )
