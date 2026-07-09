from typing import Any

from bson import ObjectId

from src.database.base_repository import BaseReadRepository, BaseWriteRepository
from src.database.collections.constants import INTERPRETATIONS_COLLECTION


class InterpretationWriteRepository(BaseWriteRepository):
    @property
    def collection_name(self) -> str:
        return INTERPRETATIONS_COLLECTION

    async def upsert_by_reading_id(self, reading_id: str, document: dict[str, Any]) -> None:
        query = {"reading_id": ObjectId(reading_id)}
        replacement = dict(document)
        existing = await self._collection.find_one(query, {"created_at": 1})
        if existing is not None:
            replacement["created_at"] = existing["created_at"]
        await self._collection.replace_one(query, replacement, upsert=True)


class InterpretationReadRepository(BaseReadRepository):
    @property
    def collection_name(self) -> str:
        return INTERPRETATIONS_COLLECTION

    async def find_by_reading_id(self, reading_id: str) -> dict[str, Any] | None:
        return await self.find_one({"reading_id": ObjectId(reading_id)})
