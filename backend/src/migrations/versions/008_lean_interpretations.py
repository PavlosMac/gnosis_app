from datetime import datetime

from motor.motor_asyncio import AsyncIOMotorDatabase

from src.database.collections.constants import INTERPRETATIONS_COLLECTION

version = "008"
description = (
    "Lean interpretations, one per reading: collapse card_interpretations + synthesis "
    "into one reading narrative, drop settings entirely, keep only the newest "
    "interpretation per reading, and re-key the unique slot index from "
    "(reading_id, settings.lens) to reading_id alone"
)

_EPOCH = datetime(1970, 1, 1)


async def up(db: AsyncIOMotorDatabase) -> None:
    collection = db[INTERPRETATIONS_COLLECTION]

    # 1. Drop the old unique slot indexes FIRST. The transforms below strip the
    #    settings fields they key on, so with either index still alive the second
    #    settings-less document of any reading raises E11000 mid-migration — and again
    #    at runtime on every second save. (reading_id, settings.intent) never shipped;
    #    it only exists on a dev database that ran an interim split of this migration,
    #    and dropping it too lets a re-run self-heal those. No-op if already gone.
    indexes = await collection.index_information()
    for name, info in indexes.items():
        key = [field for field, _ in info["key"]]
        if key in (["reading_id", "settings.lens"], ["reading_id", "settings.intent"]):
            await collection.drop_index(name)

    # 2. Collapse legacy per-card documents into the single-narrative shape. The prose
    #    is preserved verbatim — per-card texts joined as paragraphs, synthesis last.
    async for doc in collection.find({"card_interpretations": {"$exists": True}}):
        paragraphs = [
            ci["interpretation"]
            for ci in doc.get("card_interpretations", [])
            if ci.get("interpretation")
        ]
        if doc.get("synthesis"):
            paragraphs.append(doc["synthesis"])
        await collection.update_one(
            {"_id": doc["_id"]},
            {
                "$set": {"reading": "\n\n".join(paragraphs)},
                "$unset": {"card_interpretations": "", "synthesis": "", "tokens_used": ""},
            },
        )

    # 3. Settings held only prompt knobs (lens, depth, intent) the lean model no longer
    #    has — drop the sub-document entirely.
    await collection.update_many({"settings": {"$exists": True}}, {"$unset": {"settings": ""}})

    # 4. The old model allowed one slot per lens; the new key is reading_id alone, so
    #    all of a reading's slots collapse onto one key. Keep the newest, drop the rest.
    def freshness(doc: dict) -> tuple:
        # BSON datetimes come back naive; ObjectId breaks freshness ties (it is
        # monotonic per second).
        return (doc.get("updated_at") or doc.get("created_at") or _EPOCH, doc["_id"])

    seen: dict[object, dict] = {}
    async for doc in collection.find({}):
        key = doc["reading_id"]
        kept = seen.get(key)
        if kept is None:
            seen[key] = doc
            continue
        newer, older = (doc, kept) if freshness(doc) > freshness(kept) else (kept, doc)
        seen[key] = newer
        await collection.delete_one({"_id": older["_id"]})

    # 5. Create the new unique index — only now that the data satisfies it. (007
    #    dropped any legacy bare reading_id index, so no name/options conflict.)
    await collection.create_index([("reading_id", 1)], unique=True)
