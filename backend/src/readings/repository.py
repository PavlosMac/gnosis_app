from datetime import UTC, date, datetime
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo.errors import DuplicateKeyError

from src.database.base_repository import BaseReadRepository, BaseWriteRepository
from src.database.collections.constants import READINGS_COLLECTION, USER_TAGS_COLLECTION


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

    async def find_latest_by_user_id(self, user_id: str) -> dict[str, Any] | None:
        """The user's newest reading, served by the (user_id, created_at desc) index."""
        docs = await self.find_by_user_id(user_id, limit=1)
        return docs[0] if docs else None

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

    async def count_tags_by_user_id(self, user_id: str) -> list[dict[str, Any]]:
        """Every tag the user has applied with how many readings carry it — most-used
        first, ties alphabetical. Readings created without tags omit the field, and
        $unwind drops those, so no $exists guard is needed."""
        cursor = self._collection.aggregate(
            [
                {"$match": {"user_id": ObjectId(user_id)}},
                {"$unwind": "$tags"},
                {"$group": {"_id": "$tags", "count": {"$sum": 1}}},
                {"$sort": {"count": -1, "_id": 1}},
                {"$project": {"_id": 0, "name": "$_id", "count": 1}},
            ]
        )
        return await cursor.to_list(length=None)


class UserTagsWriteRepository(BaseWriteRepository):
    """One derived document per user: the tag vocabulary across all their readings.
    Rewritten whole after every tag edit rather than maintained incrementally, so a
    failed write can never leave the counts drifted from the readings."""

    @property
    def collection_name(self) -> str:
        return USER_TAGS_COLLECTION

    async def replace_for_user(self, user_id: str, tags: list[dict[str, Any]]) -> None:
        # replace_one(upsert=True) against the unique user_id index can still raise
        # E11000 when two requests race the same brand-new key — MongoDB's documented
        # upsert-race caveat, not something the unique index alone rules out. Same
        # accepted-race posture as InterpretationWriteRepository.upsert_by_reading_id:
        # the loser retries as a plain update against the document the winner just
        # created.
        oid = ObjectId(user_id)
        document = {"user_id": oid, "tags": tags, "updated_at": datetime.now(UTC)}
        try:
            await self._collection.replace_one({"user_id": oid}, document, upsert=True)
        except DuplicateKeyError:
            await self._collection.replace_one({"user_id": oid}, document)


class UserTagsReadRepository(BaseReadRepository):
    @property
    def collection_name(self) -> str:
        return USER_TAGS_COLLECTION

    async def find_by_user_id(self, user_id: str) -> dict[str, Any] | None:
        return await self.find_one({"user_id": ObjectId(user_id)})
