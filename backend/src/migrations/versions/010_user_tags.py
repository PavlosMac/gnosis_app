from datetime import UTC, datetime

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING

from src.database.collections.constants import READINGS_COLLECTION, USER_TAGS_COLLECTION

version = "010"
description = (
    "Introduce user_tags — one derived document per user holding their tag vocabulary "
    "({name, count}, most-used first), unique on user_id — and backfill it from the tags "
    "already stored on readings"
)


async def up(db: AsyncIOMotorDatabase) -> None:
    await db[USER_TAGS_COLLECTION].create_index([("user_id", ASCENDING)], unique=True)

    # Same derivation UpdateReadingTagsHandler performs per user after every tag edit
    # (ReadingReadRepository.count_tags_by_user_id), run here across all users at once.
    # Readings without tags omit the field, so $unwind alone drops them and a user with
    # no tags gets no document — no separate $exists guard needed. The tie-break order
    # (count desc, name asc) is applied with $sort before the final $group; $group's
    # $push preserves the sorted order of the documents it receives, so no second,
    # independently-drifting sort is needed on the Python side.
    cursor = db[READINGS_COLLECTION].aggregate(
        [
            {"$unwind": "$tags"},
            {"$group": {"_id": {"user_id": "$user_id", "tag": "$tags"}, "count": {"$sum": 1}}},
            {"$sort": {"count": -1, "_id.tag": 1}},
            {
                "$group": {
                    "_id": "$_id.user_id",
                    "tags": {"$push": {"name": "$_id.tag", "count": "$count"}},
                }
            },
        ]
    )
    now = datetime.now(UTC)
    async for user in cursor:
        await db[USER_TAGS_COLLECTION].replace_one(
            {"user_id": user["_id"]},
            {"user_id": user["_id"], "tags": user["tags"], "updated_at": now},
            upsert=True,
        )
