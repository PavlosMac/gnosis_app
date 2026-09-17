from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from src.database.base_repository import BaseReadRepository, BaseWriteRepository
from src.database.collections.constants import INTERPRETATIONS_COLLECTION


class InterpretationWriteRepository(BaseWriteRepository):
    @property
    def collection_name(self) -> str:
        return INTERPRETATIONS_COLLECTION

    async def upsert_by_reading_id(
        self, reading_id: str, document: dict[str, Any]
    ) -> dict[str, Any]:
        # One interpretation per reading, keyed on reading_id alone. Keying the filter on
        # reading_id makes the concurrent-generate race last-write-wins — same
        # accepted-race posture as the budget gate — but an upsert racing another upsert
        # on the same not-yet-existing key can still raise E11000 against the unique
        # reading_id index (a documented Mongo caveat, not something the unique index
        # alone rules out); the loser retries as a plain update against the document the
        # winner just created.
        # One atomic round trip: $setOnInsert pins created_at on first save, $set refreshes
        # everything else on replacement; AFTER hands back the stored doc (_id, created_at)
        # without a second read.
        fields = {k: v for k, v in document.items() if k != "created_at"}
        oid = ObjectId(reading_id)
        try:
            return await self._collection.find_one_and_update(
                {"reading_id": oid},
                {"$set": fields, "$setOnInsert": {"created_at": document["created_at"]}},
                upsert=True,
                return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError:
            return await self._collection.find_one_and_update(
                {"reading_id": oid},
                {"$set": fields},
                return_document=ReturnDocument.AFTER,
            )


class InterpretationReadRepository(BaseReadRepository):
    @property
    def collection_name(self) -> str:
        return INTERPRETATIONS_COLLECTION

    async def find_by_reading_id(self, reading_id: str) -> dict[str, Any] | None:
        # A malformed reading_id is indistinguishable from not-found — this runs
        # concurrently with the reading ownership check (which applies the same guard)
        # via asyncio.gather in GenerateInterpretationHandler, so it must not raise.
        try:
            oid = ObjectId(reading_id)
        except InvalidId:
            return None
        return await self.find_one({"reading_id": oid})
