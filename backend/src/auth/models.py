from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from bson import ObjectId


class UserStatus(StrEnum):
    """Where the account is in onboarding. A later payment step adds a member here
    (and to SESSION_STATUSES in src/auth/service.py) — nothing else changes."""

    # Created by a superadmin invite: no password, no names, no consents until the
    # invitee accepts the emailed link (POST /auth/accept-invite).
    INVITED = "invited"
    PENDING_VERIFICATION = "pending_verification"
    ACTIVE = "active"


def user_status(doc: dict[str, Any]) -> UserStatus:
    """A document without the field predates email verification and is active —
    there is deliberately no backfill."""
    return UserStatus(doc.get("status", UserStatus.ACTIVE))


def build_consents(
    terms_version: str, privacy_version: str, accepted_at: datetime
) -> dict[str, dict[str, Any]]:
    """The `consents` sub-document written when an account is created (sign-up or
    invite acceptance): both legal documents, stamped with the same acceptance time."""
    return {
        "terms": {"version": terms_version, "accepted_at": accepted_at},
        "privacy": {"version": privacy_version, "accepted_at": accepted_at},
    }


def build_display_name(first_name: str, last_name: str) -> str:
    """Every existing consumer reads display_name, so it is derived from the names
    rather than making them all learn first/last."""
    return f"{first_name} {last_name}"


class User:
    def __init__(
        self,
        email: str,
        # None only while the account is INVITED; every reader of the hash must treat
        # absence as "wrong password" (see AuthService), never as a 500.
        password_hash: str | None,
        display_name: str | None = None,
        first_name: str | None = None,
        last_name: str | None = None,
        consents: dict[str, dict[str, Any]] | None = None,
        status: UserStatus = UserStatus.ACTIVE,
        email_verified_at: datetime | None = None,
        verification_deadline_at: datetime | None = None,
        credits: int = 0,
        is_superadmin: bool = False,
        stripe_customer_id: str | None = None,
        budget_usd: float | None = None,
        usage: dict[str, Any] | None = None,
        id: str | None = None,
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
    ) -> None:
        self.id = id
        self.email = email
        self.password_hash = password_hash
        self.display_name = display_name
        self.first_name = first_name
        self.last_name = last_name
        # Per legal document: {"terms": {"version", "accepted_at"}, "privacy": {...}}
        self.consents = consents or {}
        self.status = status
        self.email_verified_at = email_verified_at
        # Purge clock for a never-verified account (TTL index, migration 014); bumped
        # on resend and removed on verification.
        self.verification_deadline_at = verification_deadline_at
        self.credits = credits
        self.is_superadmin = is_superadmin
        self.stripe_customer_id = stripe_customer_id
        # Per-user override of Settings.user_budget_usd (src/core/config.py) — absent
        # for the common case of "use the default". usage is the spend aggregate the
        # budget gate reads/writes (AuthWriteRepository.reserve_usage et al.); it does
        # not exist until that gate creates it lazily on the user's first reservation,
        # so it is never set here at construction.
        self.budget_usd = budget_usd
        self.usage = usage
        self.created_at = created_at or datetime.now(UTC)
        self.updated_at = updated_at or datetime.now(UTC)

    def to_document(self) -> dict[str, Any]:
        doc: dict[str, Any] = {
            "email": self.email,
            "status": str(self.status),
            "credits": self.credits,
            "is_superadmin": self.is_superadmin,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
        if self.password_hash is not None:
            doc["password_hash"] = self.password_hash
        if self.id:
            doc["_id"] = ObjectId(self.id)
        if self.display_name is not None:
            doc["display_name"] = self.display_name
        if self.first_name is not None:
            doc["first_name"] = self.first_name
        if self.last_name is not None:
            doc["last_name"] = self.last_name
        if self.consents:
            doc["consents"] = self.consents
        if self.email_verified_at is not None:
            doc["email_verified_at"] = self.email_verified_at
        if self.verification_deadline_at is not None:
            doc["verification_deadline_at"] = self.verification_deadline_at
        if self.stripe_customer_id is not None:
            doc["stripe_customer_id"] = self.stripe_customer_id
        if self.budget_usd is not None:
            doc["budget_usd"] = self.budget_usd
        if self.usage is not None:
            doc["usage"] = self.usage
        return doc

    @classmethod
    def from_document(cls, doc: dict[str, Any]) -> "User":
        return cls(
            id=str(doc["_id"]),
            email=doc["email"],
            password_hash=doc.get("password_hash"),
            display_name=doc.get("display_name"),
            first_name=doc.get("first_name"),
            last_name=doc.get("last_name"),
            consents=doc.get("consents"),
            status=user_status(doc),
            email_verified_at=doc.get("email_verified_at"),
            verification_deadline_at=doc.get("verification_deadline_at"),
            credits=doc.get("credits", 0),
            is_superadmin=doc.get("is_superadmin", False),
            stripe_customer_id=doc.get("stripe_customer_id"),
            budget_usd=doc.get("budget_usd"),
            usage=doc.get("usage"),
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
        )

    def update(self, **kwargs: Any) -> None:
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
        self.updated_at = datetime.now(UTC)
