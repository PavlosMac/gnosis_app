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
        total_tokens_used: int = 0,
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
        self.total_tokens_used = total_tokens_used
        self.created_at = created_at or datetime.now(UTC)
        self.updated_at = updated_at or datetime.now(UTC)

    def to_document(self) -> dict[str, Any]:
        doc: dict[str, Any] = {
            "email": self.email,
            "password_hash": self.password_hash,
            "credits": self.credits,
            "is_superadmin": self.is_superadmin,
            "total_tokens_used": self.total_tokens_used,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
        if self.id:
            doc["_id"] = ObjectId(self.id)
        if self.display_name is not None:
            doc["display_name"] = self.display_name
        if self.stripe_customer_id is not None:
            doc["stripe_customer_id"] = self.stripe_customer_id
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
            total_tokens_used=doc.get("total_tokens_used", 0),
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
        )

    def update(self, **kwargs: Any) -> None:
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
        self.updated_at = datetime.now(UTC)
