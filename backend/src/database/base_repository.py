from abc import ABC, abstractmethod
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorDatabase


class BaseWriteRepository(ABC):
    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db[self.collection_name]

    @property
    @abstractmethod
    def collection_name(self) -> str: ...

    async def insert(self, document: dict[str, Any]) -> str:
        result = await self._collection.insert_one(document)
        return str(result.inserted_id)

    async def update(self, id: str, update: dict[str, Any]) -> bool:
        result = await self._collection.update_one({"_id": ObjectId(id)}, {"$set": update})
        return result.modified_count > 0

    async def delete(self, id: str) -> bool:
        result = await self._collection.delete_one({"_id": ObjectId(id)})
        return result.deleted_count > 0


class BaseReadRepository(ABC):
    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db[self.collection_name]

    @property
    @abstractmethod
    def collection_name(self) -> str: ...

    async def find_by_id(self, id: str) -> dict[str, Any] | None:
        try:
            return await self._collection.find_one({"_id": ObjectId(id)})
        except InvalidId:
            return None

    async def find_one(self, filter: dict[str, Any]) -> dict[str, Any] | None:
        return await self._collection.find_one(filter)

    async def find_many(
        self,
        filter: dict[str, Any],
        skip: int = 0,
        limit: int = 20,
        sort: list[tuple[str, int]] | None = None,
    ) -> list[dict[str, Any]]:
        cursor = self._collection.find(filter).skip(skip).limit(limit)
        if sort:
            cursor = cursor.sort(sort)
        return await cursor.to_list(length=limit)

    async def count(self, filter: dict[str, Any]) -> int:
        return await self._collection.count_documents(filter)
