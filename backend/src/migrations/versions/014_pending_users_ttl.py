from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING

from src.database.collections.constants import USERS_COLLECTION

version = "014"
description = "TTL purge of never-verified accounts (users.verification_deadline_at)"


async def up(db: AsyncIOMotorDatabase) -> None:
    # Mongo deletes a pending account once its deadline passes; no job, no code path.
    # The partial filter means active and legacy users (no status field) never match,
    # and verifying removes the field as well as flipping the status. Resend moves the
    # deadline forward, so a user who is still trying is not purged mid-verification.
    await db[USERS_COLLECTION].create_index(
        [("verification_deadline_at", ASCENDING)],
        expireAfterSeconds=0,
        partialFilterExpression={"status": "pending_verification"},
        name="pending_users_ttl",
    )
