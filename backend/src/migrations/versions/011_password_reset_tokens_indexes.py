from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING

from src.database.collections.constants import (
    PASSWORD_RESET_ATTEMPTS_COLLECTION,
    PASSWORD_RESET_TOKENS_COLLECTION,
)

version = "011"
description = "Indexes for password reset tokens and throttle attempts (TTL cleanup)"


async def up(db: AsyncIOMotorDatabase) -> None:
    await db[PASSWORD_RESET_TOKENS_COLLECTION].create_index("token_hash", unique=True)
    await db[PASSWORD_RESET_TOKENS_COLLECTION].create_index("user_id")
    await db[PASSWORD_RESET_TOKENS_COLLECTION].create_index(
        [("expires_at", ASCENDING)], expireAfterSeconds=0
    )
    await db[PASSWORD_RESET_ATTEMPTS_COLLECTION].create_index("key")
    await db[PASSWORD_RESET_ATTEMPTS_COLLECTION].create_index([("created_at", -1)])
    await db[PASSWORD_RESET_ATTEMPTS_COLLECTION].create_index(
        [("expires_at", ASCENDING)], expireAfterSeconds=0
    )
