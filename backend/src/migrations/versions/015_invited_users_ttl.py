from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING

from src.database.collections.constants import USERS_COLLECTION

version = "015"
description = "Extend the never-verified purge (pending_users_ttl) to invited accounts"

_INDEX_NAME = "pending_users_ttl"


async def up(db: AsyncIOMotorDatabase) -> None:
    # A partial index's filter cannot be changed in place, and create_index with the
    # same name but different options raises (Mongo code 85, mongomock too), so the
    # 014 index is dropped first. drop_index on a missing index raises as well, hence
    # the existence check — that is what makes a re-run (or a fresh db) safe.
    collection = db[USERS_COLLECTION]
    dropped = _INDEX_NAME in await collection.index_information()
    if dropped:
        await collection.drop_index(_INDEX_NAME)
    # Invited accounts share the deadline field: the invite link and the account expire
    # together, and a resend moves the deadline forward exactly like a verification resend.
    # `$in` in a partialFilterExpression needs MongoDB 6.0+ (compose and prod run 7).
    try:
        await collection.create_index(
            [("verification_deadline_at", ASCENDING)],
            expireAfterSeconds=0,
            partialFilterExpression={"status": {"$in": ["pending_verification", "invited"]}},
            name=_INDEX_NAME,
        )
    except Exception:
        # Do not leave the collection without a purge index (an older server rejecting
        # `$in`, say): put 014's definition back, then fail the migration so it is
        # retried rather than recorded as applied.
        if dropped:
            await collection.create_index(
                [("verification_deadline_at", ASCENDING)],
                expireAfterSeconds=0,
                partialFilterExpression={"status": "pending_verification"},
                name=_INDEX_NAME,
            )
        raise
