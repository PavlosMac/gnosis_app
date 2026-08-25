from typing import Any

from bson import ObjectId

from src.database.base_repository import BaseReadRepository, BaseWriteRepository
from src.database.collections.constants import INTERPRETATIONS_COLLECTION


class InterpretationWriteRepository(BaseWriteRepository):
    @property
    def collection_name(self) -> str:
        return INTERPRETATIONS_COLLECTION

    async def upsert_by_lens(self, reading_id: str, document: dict[str, Any]) -> None:
        # lens is read from the document rather than taken as a separate argument, so
        # the slot key can never diverge from document["settings"]["lens"]. One atomic
        # round trip: $setOnInsert pins created_at on first save, $set refreshes
        # everything else on replacement.
        lens = document["settings"]["lens"]
        fields = {k: v for k, v in document.items() if k != "created_at"}
        await self._collection.update_one(
            {"reading_id": ObjectId(reading_id), "settings.lens": lens},
            {"$set": fields, "$setOnInsert": {"created_at": document["created_at"]}},
            upsert=True,
        )


class InterpretationReadRepository(BaseReadRepository):
    @property
    def collection_name(self) -> str:
        return INTERPRETATIONS_COLLECTION

    async def find_by_lens(self, reading_id: str, lens: str) -> dict[str, Any] | None:
        return await self.find_one({"reading_id": ObjectId(reading_id), "settings.lens": lens})

    async def find_all_by_reading_id(self, reading_id: str) -> list[dict[str, Any]]:
        # The unique (reading_id, settings.lens) index caps this at one doc per lens.
        return await self.find_many({"reading_id": ObjectId(reading_id)}, sort=[("created_at", 1)])
