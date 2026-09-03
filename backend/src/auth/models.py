from datetime import UTC, datetime
from typing import Any

from bson import ObjectId


class User:
    def __init__(
        self,
        email: str,
        password_hash: str,
        display_name: str | None = None,
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
            "password_hash": self.password_hash,
            "credits": self.credits,
            "is_superadmin": self.is_superadmin,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
        if self.id:
            doc["_id"] = ObjectId(self.id)
        if self.display_name is not None:
            doc["display_name"] = self.display_name
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
            password_hash=doc["password_hash"],
            display_name=doc.get("display_name"),
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
