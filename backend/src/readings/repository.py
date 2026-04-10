from typing import Any

from bson import ObjectId

from src.database.base_repository import BaseReadRepository, BaseWriteRepository
from src.database.collections.constants import READINGS_COLLECTION


class ReadingWriteRepository(BaseWriteRepository):
    @property
    def collection_name(self) -> str:
        return READINGS_COLLECTION


class ReadingReadRepository(BaseReadRepository):
    @property
    def collection_name(self) -> str:
        return READINGS_COLLECTION

    async def find_by_user_id(
        self,
        user_id: str,
        skip: int = 0,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        return await self.find_many(
            {"user_id": ObjectId(user_id)},
            skip=skip,
            limit=limit,
            sort=[("created_at", -1)],
        )

    async def count_by_user_id(self, user_id: str) -> int:
        return await self.count({"user_id": ObjectId(user_id)})
