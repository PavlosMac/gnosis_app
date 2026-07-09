from typing import Any

from bson import ObjectId

from src.database.base_repository import BaseReadRepository, BaseWriteRepository
from src.database.collections.constants import INTERPRETATIONS_COLLECTION


class InterpretationWriteRepository(BaseWriteRepository):
    @property
    def collection_name(self) -> str:
        return INTERPRETATIONS_COLLECTION

    async def upsert_by_reading_id(self, reading_id: str, document: dict[str, Any]) -> None:
        replacement = {key: value for key, value in document.items() if key != "created_at"}
        await self._collection.update_one(
            {"reading_id": ObjectId(reading_id)},
            {
                "$set": replacement,
                "$setOnInsert": {"created_at": document["created_at"]},
            },
            upsert=True,
        )


class InterpretationReadRepository(BaseReadRepository):
    @property
    def collection_name(self) -> str:
        return INTERPRETATIONS_COLLECTION

    async def find_by_reading_id(self, reading_id: str) -> dict[str, Any] | None:
        return await self.find_one({"reading_id": ObjectId(reading_id)})
