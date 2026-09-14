from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument

from src.database.base_repository import BaseReadRepository, BaseWriteRepository
from src.database.collections.constants import (
    PASSWORD_RESET_ATTEMPTS_COLLECTION,
    PASSWORD_RESET_TOKENS_COLLECTION,
    REFRESH_TOKENS_COLLECTION,
    USERS_COLLECTION,
)


class AuthWriteRepository(BaseWriteRepository):
    @property
    def collection_name(self) -> str:
        return USERS_COLLECTION

    async def reserve_usage(self, user_id: str, amount_usd: float, budget_usd: float) -> bool:
        """Atomically reserve `amount_usd` against the user's spend aggregate.

        Check and reserve are one filtered find_one_and_update, so concurrent requests
        cannot stack overshoot: the filter compares spend-so-far against budget, meaning
        the cap can be exceeded by at most one reservation. The usage aggregate is
        created lazily — a user with no `usage.cost_usd` yet has spent nothing, so `$expr`
        with `$ifNull` treats it as 0 rather than exempting the first call from the budget
        check entirely. Returns False when the budget is already exhausted (or the user
        does not exist)."""
        doc = await self._collection.find_one_and_update(
            {
                "_id": ObjectId(user_id),
                "$expr": {"$lt": [{"$ifNull": ["$usage.cost_usd", 0]}, budget_usd]},
            },
            {"$inc": {"usage.cost_usd": amount_usd}},
        )
        return doc is not None

    async def settle_usage(
        self,
        user_id: str,
        reserved_usd: float,
        actual_cost_usd: float,
        prompt_tokens: int,
        completion_tokens: int,
    ) -> float:
        """Adjust the reservation to actuals and record the usage split.

        Returns the user's total spend after settling."""
        doc = await self._collection.find_one_and_update(
            {"_id": ObjectId(user_id)},
            {
                "$inc": {
                    "usage.cost_usd": actual_cost_usd - reserved_usd,
                    "usage.prompt_tokens": prompt_tokens,
                    "usage.completion_tokens": completion_tokens,
                    "usage.readings": 1,
                },
                "$set": {"usage.updated_at": datetime.now(UTC)},
            },
            return_document=ReturnDocument.AFTER,
        )
        return doc["usage"]["cost_usd"] if doc else actual_cost_usd

    async def release_usage(self, user_id: str, reserved_usd: float) -> None:
        """Give the reservation back — the user is never charged for a reading they
        didn't receive."""
        await self._collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$inc": {"usage.cost_usd": -reserved_usd}},
        )


class AuthReadRepository(BaseReadRepository):
    @property
    def collection_name(self) -> str:
        return USERS_COLLECTION

    async def find_by_email(self, email: str) -> dict[str, Any] | None:
        return await self.find_one({"email": email})

    async def find_dashboard_fields(self, user_id: str) -> dict[str, Any] | None:
        """The user document projected to what the dashboard renders plus what the
        remaining-budget calculation needs — never the password hash. Malformed-id
        handling comes from find_by_id."""
        return await self.find_by_id(
            user_id,
            projection={
                "email": 1,
                "display_name": 1,
                "is_superadmin": 1,
                "created_at": 1,
                "budget_usd": 1,
                "usage.cost_usd": 1,
            },
        )


class RefreshTokenRepository:
    def __init__(self, db) -> None:
        self._collection = db[REFRESH_TOKENS_COLLECTION]

    async def store(self, jti: str, family_id: str, user_id: str, expires_at: datetime) -> None:
        await self._collection.insert_one(
            {
                "jti": jti,
                "family_id": family_id,
                "user_id": user_id,
                "used": False,
                "expires_at": expires_at,
            }
        )

    async def consume(self, jti: str) -> dict[str, Any] | None:
        """Atomically find an unused refresh token and mark it as consumed."""
        return await self._collection.find_one_and_update(
            {"jti": jti, "used": False},
            {"$set": {"used": True}},
        )

    async def revoke_family(self, family_id: str) -> None:
        await self._collection.delete_many({"family_id": family_id})

    async def revoke_all_for_user(self, user_id: str) -> None:
        """Password reset kills every session — all families, all devices."""
        await self._collection.delete_many({"user_id": user_id})


class PasswordResetTokenRepository:
    def __init__(self, db) -> None:
        self._collection = db[PASSWORD_RESET_TOKENS_COLLECTION]

    async def store(self, token_hash: str, user_id: str, expires_at: datetime) -> None:
        await self._collection.insert_one(
            {
                "token_hash": token_hash,
                "user_id": user_id,
                "used": False,
                "expires_at": expires_at,
            }
        )

    async def consume(self, token_hash: str) -> dict[str, Any] | None:
        """Atomically mark an unused token used. Deliberately no expires_at filter —
        the handler distinguishes invalid (None) from expired (stale doc) for the
        400-vs-410 split."""
        return await self._collection.find_one_and_update(
            {"token_hash": token_hash, "used": False},
            {"$set": {"used": True}},
        )

    async def invalidate_all_for_user(self, user_id: str) -> None:
        await self._collection.delete_many({"user_id": user_id, "used": False})


class PasswordResetThrottleRepository:
    """Mongo-backed per-key request throttle; `key` is generic (currently the email)
    so a per-IP variant can reuse the collection via a prefix later."""

    def __init__(self, db) -> None:
        self._collection = db[PASSWORD_RESET_ATTEMPTS_COLLECTION]

    async def record_attempt(self, key: str, expires_at: datetime) -> None:
        await self._collection.insert_one(
            {"key": key, "created_at": datetime.now(UTC), "expires_at": expires_at}
        )

    async def count_recent(self, key: str, since: datetime) -> int:
        return await self._collection.count_documents(
            {"key": key, "created_at": {"$gte": since}}
        )
