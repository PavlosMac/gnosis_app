import re
from datetime import UTC, datetime, timedelta
from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument

from src.auth.models import UserStatus, build_display_name
from src.database.base_repository import BaseReadRepository, BaseWriteRepository
from src.database.collections.constants import (
    EMAIL_VERIFICATION_TOKENS_COLLECTION,
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

    async def record_consent(
        self, user_id: str, document: str, version: str, accepted_at: datetime
    ) -> bool:
        """Store acceptance of one legal document, unless that exact version is already
        recorded. The record is evidence of when consent was given, so re-saving an
        unchanged version must not move accepted_at. The dotted key leaves the other
        document's record alone. Returns True when something was written."""
        result = await self._collection.update_one(
            {"_id": ObjectId(user_id), f"consents.{document}.version": {"$ne": version}},
            {
                "$set": {
                    f"consents.{document}": {"version": version, "accepted_at": accepted_at},
                    "updated_at": accepted_at,
                }
            },
        )
        return result.modified_count > 0

    async def mark_email_verified(self, user_id: str, verified_at: datetime) -> bool:
        """Flip a pending account to active and take it off the purge clock. Returns
        False when the user no longer exists (purged between send and confirm) or is not
        pending — verification tokens share a collection with invite tokens, and an
        invited account must only ever be activated by accepting its invite. Also what
        makes a verification link single-use: of two concurrent confirms, one matches."""
        result = await self._collection.update_one(
            {"_id": ObjectId(user_id), "status": str(UserStatus.PENDING_VERIFICATION)},
            {
                "$set": {
                    "status": str(UserStatus.ACTIVE),
                    "email_verified_at": verified_at,
                    "updated_at": verified_at,
                },
                "$unset": {"verification_deadline_at": ""},
            },
        )
        return result.matched_count > 0

    async def extend_invite(self, user_id: str, deadline: datetime, now: datetime) -> bool:
        """Re-invite: move the purge clock forward, but only while the account is still
        invited. Guarded on status so a resend racing an accept cannot put a purge
        deadline back on an active user. Returns False when it no longer matches."""
        result = await self._collection.update_one(
            {"_id": ObjectId(user_id), "status": str(UserStatus.INVITED)},
            {"$set": {"verification_deadline_at": deadline, "updated_at": now}},
        )
        return result.matched_count > 0

    async def activate_invited(
        self,
        user_id: str,
        *,
        password_hash: str,
        first_name: str,
        last_name: str,
        consents: dict[str, Any],
        activated_at: datetime,
    ) -> bool:
        """Accepting an invite: the account gets everything registration would have
        given it and goes straight to active (opening the emailed link proved the
        address). Guarded on status so two concurrent accepts cannot both win."""
        result = await self._collection.update_one(
            {"_id": ObjectId(user_id), "status": str(UserStatus.INVITED)},
            {
                "$set": {
                    "password_hash": password_hash,
                    "first_name": first_name,
                    "last_name": last_name,
                    "display_name": build_display_name(first_name, last_name),
                    "consents": consents,
                    "status": str(UserStatus.ACTIVE),
                    "email_verified_at": activated_at,
                    "updated_at": activated_at,
                },
                "$unset": {"verification_deadline_at": ""},
            },
        )
        return result.matched_count > 0


class AuthReadRepository(BaseReadRepository):
    @property
    def collection_name(self) -> str:
        return USERS_COLLECTION

    async def find_by_email(self, email: str) -> dict[str, Any] | None:
        """Emails are stored lower-cased (every writer folds them), so folding the
        query makes the lookup case-insensitive for every caller."""
        return await self.find_one({"email": email.strip().lower()})

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
            {"$set": {"used": True, "used_at": datetime.now(UTC)}},
        )

    async def was_just_consumed(self, jti: str, grace_seconds: int) -> bool:
        """Whether this token was rotated within the last few seconds. Two refreshes
        racing with the same token (two tabs, a proxy plus a render) are a client
        race, not theft, so the loser must not revoke the winner's session."""
        doc = await self._collection.find_one({"jti": jti, "used": True}, {"used_at": 1})
        used_at = doc.get("used_at") if doc else None
        if used_at is None:
            return False
        if used_at.tzinfo is None:
            used_at = used_at.replace(tzinfo=UTC)
        return datetime.now(UTC) - used_at <= timedelta(seconds=grace_seconds)

    async def revoke_family(self, family_id: str) -> None:
        await self._collection.delete_many({"family_id": family_id})

    async def family_is_live(self, family_id: str) -> bool:
        """Whether the session still exists. Rotation keeps a family's rows (used ones
        stay until their TTL), so only a revoke or an expiry empties it."""
        return await self._collection.find_one({"family_id": family_id}, {"_id": 1}) is not None

    async def revoke_all_for_user(self, user_id: str) -> None:
        """Password reset and account deletion kill every session — all families, all
        devices."""
        await self._collection.delete_many({"user_id": user_id})


class OneTimeTokenRepository:
    """Hashed single-use tokens for emailed links. One collection per purpose
    (password reset, email verification) via the thin subclasses below."""

    def __init__(self, db, collection: str) -> None:
        self._collection = db[collection]

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

    async def peek(self, token_hash: str) -> dict[str, Any] | None:
        """The unused token without consuming it — for checks that must not burn a
        single-use link when they fail (e.g. the new password is refused)."""
        return await self._collection.find_one({"token_hash": token_hash, "used": False})

    async def invalidate_all_for_user(self, user_id: str) -> None:
        await self._collection.delete_many({"user_id": user_id, "used": False})

    async def delete_all_for_user(self, user_id: str) -> None:
        """Account deletion: used and unused alike."""
        await self._collection.delete_many({"user_id": user_id})


class PasswordResetTokenRepository(OneTimeTokenRepository):
    def __init__(self, db) -> None:
        super().__init__(db, PASSWORD_RESET_TOKENS_COLLECTION)


class EmailVerificationTokenRepository(OneTimeTokenRepository):
    def __init__(self, db) -> None:
        super().__init__(db, EMAIL_VERIFICATION_TOKENS_COLLECTION)


class ThrottleRepository:
    """Mongo-backed per-key request throttle. Every limiter shares one collection
    (TTL-cleaned by migration 011); `key_prefix` keeps their keys apart — "login:",
    "register:", "verify:". Password reset uses the bare email and support prefixes its
    own keys, both through PasswordResetThrottleRepository."""

    def __init__(
        self,
        db,
        collection: str = PASSWORD_RESET_ATTEMPTS_COLLECTION,
        key_prefix: str = "",
    ) -> None:
        self._collection = db[collection]
        self._key_prefix = key_prefix

    async def record_attempt(self, key: str, expires_at: datetime) -> None:
        await self._collection.insert_one(
            {
                "key": f"{self._key_prefix}{key}",
                "created_at": datetime.now(UTC),
                "expires_at": expires_at,
            }
        )

    async def count_recent(self, key: str, since: datetime) -> int:
        return await self._collection.count_documents(
            {"key": f"{self._key_prefix}{key}", "created_at": {"$gte": since}}
        )

    async def is_over_limit(self, key: str, window_seconds: int, max_attempts: int) -> bool:
        """Record this call, then count. Record-before-count means the count includes
        the call's own attempt, so a concurrent burst can only over-throttle (everyone
        sees everyone's insert), never under-throttle."""
        now = datetime.now(UTC)
        window = timedelta(seconds=window_seconds)
        await self.record_attempt(key, expires_at=now + window)
        return await self.count_recent(key, since=now - window) > max_attempts

    async def delete_for_account(self, email: str, user_id: str) -> None:
        """Account deletion: throttle records are keyed by the user's email or id, so
        they are personal data too. Matches the stored (already prefixed) keys of every
        limiter — call it on the unprefixed repository. They would expire within the
        hour anyway; erasure should not wait for that."""
        await self._collection.delete_many(
            {
                "$or": [
                    {"key": email},
                    {"key": f"verify:{email}"},
                    {"key": f"support:{user_id}"},
                    {"key": f"login:delete:{user_id}"},
                    # login:<ip>:<email> for any ip
                    {"key": {"$regex": f"^login:.*:{re.escape(email)}$"}},
                ]
            }
        )


class PasswordResetThrottleRepository(ThrottleRepository):
    def __init__(self, db) -> None:
        super().__init__(db)
