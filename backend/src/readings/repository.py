from datetime import date
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId

from src.database.base_repository import BaseReadRepository, BaseWriteRepository
from src.database.collections.constants import READINGS_COLLECTION


def _build_filter(
    user_id: str,
    spread_type: str | None,
    birth_date: date | None,
    tags: list[str] | None = None,
) -> dict[str, Any]:
    filter_: dict[str, Any] = {"user_id": ObjectId(user_id)}
    if spread_type:
        filter_["spread_type"] = spread_type
    if birth_date:
        filter_["birth_date"] = birth_date.isoformat()
    if tags is not None:
        filter_["tags"] = {"$in": tags}
    return filter_


class ReadingWriteRepository(BaseWriteRepository):
    @property
    def collection_name(self) -> str:
        return READINGS_COLLECTION


class ReadingReadRepository(BaseReadRepository):
    @property
    def collection_name(self) -> str:
        return READINGS_COLLECTION

    async def find_owned(self, reading_id: str, user_id: str) -> dict[str, Any] | None:
        """The reading if it exists and belongs to user_id, else None — a malformed
        reading_id is indistinguishable from not-found, so ownership checks can't leak
        whether an id exists."""
        try:
            oid = ObjectId(reading_id)
        except InvalidId:
            return None
        return await self.find_one({"_id": oid, "user_id": ObjectId(user_id)})

    async def find_by_user_id(
        self,
        user_id: str,
        skip: int = 0,
        limit: int = 20,
        spread_type: str | None = None,
        birth_date: date | None = None,
    ) -> list[dict[str, Any]]:
        return await self.find_many(
            _build_filter(user_id, spread_type, birth_date),
            skip=skip,
            limit=limit,
            sort=[("created_at", -1)],
        )

    async def count_by_user_id(
        self,
        user_id: str,
        spread_type: str | None = None,
        birth_date: date | None = None,
        tags: list[str] | None = None,
    ) -> int:
        return await self.count(_build_filter(user_id, spread_type, birth_date, tags))

    async def find_by_user_id_ranked_by_tags(
        self,
        user_id: str,
        tags: list[str],
        skip: int = 0,
        limit: int = 20,
        spread_type: str | None = None,
        birth_date: date | None = None,
    ) -> list[dict[str, Any]]:
        match_filter = _build_filter(user_id, spread_type, birth_date, tags)
        cursor = self._collection.aggregate(
            [
                {"$match": match_filter},
                {
                    "$addFields": {
                        "matched_tag_count": {
                            "$size": {
                                "$filter": {
                                    "input": "$tags",
                                    "cond": {"$in": ["$$this", tags]},
                                }
                            }
                        }
                    }
                },
                {"$sort": {"matched_tag_count": -1, "created_at": -1}},
                {"$skip": skip},
                {"$limit": limit},
            ]
        )
        return await cursor.to_list(length=limit)
