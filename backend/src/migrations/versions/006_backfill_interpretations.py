from motor.motor_asyncio import AsyncIOMotorDatabase

from src.database.collections.constants import INTERPRETATIONS_COLLECTION, READINGS_COLLECTION

version = "006"
description = "Backfill interpretations collection from embedded reading data"

# Pre-settings readings never had style/depth/tone — assume the documented defaults.
_DEFAULT_SETTINGS = {"style": "reflective", "depth": 60, "tone": 50}


async def up(db: AsyncIOMotorDatabase) -> None:
    async for reading in db[READINGS_COLLECTION].find({"card_interpretations": {"$exists": True}}):
        await db[INTERPRETATIONS_COLLECTION].update_one(
            {"reading_id": reading["_id"]},
            {
                "$setOnInsert": {
                    "reading_id": reading["_id"],
                    "user_id": reading["user_id"],
                    "card_interpretations": reading["card_interpretations"],
                    "synthesis": reading["synthesis"],
                    "tokens_used": reading.get("tokens_used", 0),
                    "model": reading.get("model", ""),
                    "settings": _DEFAULT_SETTINGS,
                    "created_at": reading.get("created_at"),
                    "updated_at": reading.get("created_at"),
                }
            },
            upsert=True,
        )
