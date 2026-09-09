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

    # Same derivation UpdateReadingTagsHandler performs per user after every tag edit,
    # run once here across all users. Readings without tags omit the field, so $match
    # on $exists skips them and users with no tags get no document.
    cursor = db[READINGS_COLLECTION].aggregate(
        [
            {"$match": {"tags": {"$exists": True}}},
            {"$unwind": "$tags"},
            {"$group": {"_id": {"user_id": "$user_id", "tag": "$tags"}, "count": {"$sum": 1}}},
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
        tags = sorted(user["tags"], key=lambda tag: (-tag["count"], tag["name"]))
        await db[USER_TAGS_COLLECTION].replace_one(
            {"user_id": user["_id"]},
            {"user_id": user["_id"], "tags": tags, "updated_at": now},
            upsert=True,
        )
