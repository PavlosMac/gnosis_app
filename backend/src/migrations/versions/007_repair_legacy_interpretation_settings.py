from motor.motor_asyncio import AsyncIOMotorDatabase

from src.database.collections.constants import INTERPRETATIONS_COLLECTION

version = "007"
description = (
    "Repair environments that ran the pre-lens 005/006: drop the stale single-field "
    "unique index on reading_id and remap legacy style/depth/tone settings to lens/intent/depth"
)

# Same defaults 006 uses for pre-settings readings — "traditional"/"reflective" is the
# least-claiming label, not a description of how these were actually generated.
_LEGACY_LENS_DEFAULT = "traditional"
_LEGACY_INTENT_DEFAULT = "reflective"


async def up(db: AsyncIOMotorDatabase) -> None:
    collection = db[INTERPRETATIONS_COLLECTION]

    # Drop the old single-field unique index on reading_id, if this DB ran the
    # pre-lens version of migration 005. No-op if it is already gone.
    indexes = await collection.index_information()
    for name, info in indexes.items():
        keys = [field for field, _ in info["key"]]
        if keys == ["reading_id"] and info.get("unique"):
            await collection.drop_index(name)

    # Ensure the compound unique index exists. No-op if 005 already created it.
    await collection.create_index([("reading_id", 1), ("settings.lens", 1)], unique=True)

    # Remap documents written under the pre-lens settings shape (style/depth/tone,
    # no lens/intent) — from the pre-lens version of migration 006, or from the old
    # POST /interpretation endpoint.
    # Projection: only settings.depth is read — legacy docs carry full prose bodies
    # that would otherwise ride along for nothing.
    async for doc in collection.find({"settings.lens": {"$exists": False}}, {"settings.depth": 1}):
        depth = doc.get("settings", {}).get("depth", 60)
        await collection.update_one(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "settings": {
                        "lens": _LEGACY_LENS_DEFAULT,
                        "intent": _LEGACY_INTENT_DEFAULT,
                        "depth": depth,
                    }
                }
            },
        )
