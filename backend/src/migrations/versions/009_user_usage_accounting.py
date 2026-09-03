from motor.motor_asyncio import AsyncIOMotorDatabase

from src.database.collections.constants import USERS_COLLECTION

version = "009"
description = (
    "Retire the legacy total_tokens_used counter on users — superseded by the usage "
    "aggregate (usage.{prompt_tokens, completion_tokens, cost_usd, readings, updated_at}, "
    "created lazily by the budget gate) and the optional budget_usd override"
)


async def up(db: AsyncIOMotorDatabase) -> None:
    await db[USERS_COLLECTION].update_many(
        {"total_tokens_used": {"$exists": True}},
        {"$unset": {"total_tokens_used": ""}},
    )
