from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING

from src.database.collections.constants import EMAIL_VERIFICATION_TOKENS_COLLECTION

version = "013"
description = "Indexes for email verification tokens (lookup, per-user cleanup, TTL)"


async def up(db: AsyncIOMotorDatabase) -> None:
    await db[EMAIL_VERIFICATION_TOKENS_COLLECTION].create_index("token_hash", unique=True)
    await db[EMAIL_VERIFICATION_TOKENS_COLLECTION].create_index("user_id")
    await db[EMAIL_VERIFICATION_TOKENS_COLLECTION].create_index(
        [("expires_at", ASCENDING)], expireAfterSeconds=0
    )
