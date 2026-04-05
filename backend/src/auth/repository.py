from datetime import datetime
from typing import Any

from src.database.base_repository import BaseReadRepository, BaseWriteRepository
from src.database.collections.constants import REFRESH_TOKENS_COLLECTION, USERS_COLLECTION


class AuthWriteRepository(BaseWriteRepository):
    @property
    def collection_name(self) -> str:
        return USERS_COLLECTION


class AuthReadRepository(BaseReadRepository):
    @property
    def collection_name(self) -> str:
        return USERS_COLLECTION

    async def find_by_email(self, email: str) -> dict[str, Any] | None:
        return await self.find_one({"email": email})


class RefreshTokenRepository:
    def __init__(self, db) -> None:
        self._collection = db[REFRESH_TOKENS_COLLECTION]

    async def store(self, jti: str, family_id: str, user_id: str, expires_at: datetime) -> None:
        await self._collection.insert_one(
            {
                "jti": jti,
                "family_id": family_id,
                "user_id": user_id,
                "used": False,
                "expires_at": expires_at,
            }
        )

    async def consume(self, jti: str) -> dict[str, Any] | None:
        """Atomically find an unused refresh token and mark it as consumed."""
        return await self._collection.find_one_and_update(
            {"jti": jti, "used": False},
            {"$set": {"used": True}},
        )

    async def revoke_family(self, family_id: str) -> None:
        await self._collection.delete_many({"family_id": family_id})

