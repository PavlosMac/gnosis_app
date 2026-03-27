from typing import Any

from src.database.base_repository import BaseReadRepository, BaseWriteRepository
from src.database.collections.constants import USERS_COLLECTION


class UserWriteRepository(BaseWriteRepository):
    @property
    def collection_name(self) -> str:
        return USERS_COLLECTION

    async def ensure_indexes(self) -> None:
        await self._collection.create_index("email", unique=True)
        await self._collection.create_index("stripe_customer_id", unique=True, sparse=True)
        await self._collection.create_index([("created_at", -1)])


class UserReadRepository(BaseReadRepository):
    @property
    def collection_name(self) -> str:
        return USERS_COLLECTION

    async def find_by_email(self, email: str) -> dict[str, Any] | None:
        return await self.find_one({"email": email})
