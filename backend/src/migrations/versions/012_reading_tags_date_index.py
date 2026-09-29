from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING

from src.database.collections.constants import READINGS_COLLECTION

version = "012"
description = (
    "Index readings on (user_id, tags, created_at desc) so a tag-filtered list with a "
    "date sort is served from the index instead of sorted in memory, and retire 003's "
    "(user_id, tags), now a prefix of it"
)


async def up(db: AsyncIOMotorDatabase) -> None:
    collection = db[READINGS_COLLECTION]

    # Create before dropping, so a tag filter is never left without an index. With one
    # tag the planner walks this index in date order; with several it merges one
    # scan per tag (SORT_MERGE) — verified with explain() on Mongo 7.0.
    await collection.create_index(
        [("user_id", ASCENDING), ("tags", ASCENDING), ("created_at", DESCENDING)]
    )

    # (user_id, tags) is a strict prefix of the new index, so every query it served
    # is served by the new one. Match on the key pattern, not the name. No-op if gone.
    indexes = await collection.index_information()
    for name, info in indexes.items():
        if info["key"] == [("user_id", 1), ("tags", 1)]:
            await collection.drop_index(name)
