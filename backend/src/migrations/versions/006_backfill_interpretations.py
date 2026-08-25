from motor.motor_asyncio import AsyncIOMotorDatabase

from src.database.collections.constants import INTERPRETATIONS_COLLECTION, READINGS_COLLECTION

version = "006"
description = "Backfill interpretations collection from embedded reading data"

# These readings predate settings entirely. "traditional" is the frontend default and the
# least-claiming label — not a description of how they were generated.
_DEFAULT_SETTINGS = {"lens": "traditional", "intent": "reflective", "depth": 60}

# Only the fields this migration actually reads — avoids pulling each full reading
# document (cards, tags, question, ...) over the wire for nothing.
_PROJECTION = {
    "user_id": 1,
    "card_interpretations": 1,
    "synthesis": 1,
    "tokens_used": 1,
    "model": 1,
    "created_at": 1,
}


async def _upsert_interpretation(db: AsyncIOMotorDatabase, reading: dict) -> None:
    await db[INTERPRETATIONS_COLLECTION].update_one(
        {"reading_id": reading["_id"], "settings.lens": _DEFAULT_SETTINGS["lens"]},
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


async def up(db: AsyncIOMotorDatabase) -> None:
    cursor = db[READINGS_COLLECTION].find({"card_interpretations": {"$exists": True}}, _PROJECTION)
    async for reading in cursor:
        await _upsert_interpretation(db, reading)
