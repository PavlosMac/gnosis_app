from datetime import datetime

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING

from src.database.collections.constants import TOKEN_BLACKLIST_COLLECTION


class TokenBlacklistRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._collection = db[TOKEN_BLACKLIST_COLLECTION]

    async def add(self, jti: str, user_id: str, expires_at: datetime) -> None:
        await self._collection.insert_one(
            {"jti": jti, "user_id": user_id, "expires_at": expires_at}
        )

    async def is_blacklisted(self, jti: str) -> bool:
        doc = await self._collection.find_one({"jti": jti})
        return doc is not None

    async def ensure_indexes(self) -> None:
        await self._collection.create_index("jti", unique=True)
        await self._collection.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)
