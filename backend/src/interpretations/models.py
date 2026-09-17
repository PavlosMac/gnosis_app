from datetime import UTC, datetime
from typing import Any

from bson import ObjectId


class Interpretation:
    def __init__(
        self,
        reading_id: str,
        user_id: str,
        reading: str,
        model: str,
        usage: dict[str, Any] | None = None,
        id: str | None = None,
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
    ) -> None:
        self.id = id
        self.reading_id = reading_id
        self.user_id = user_id
        self.reading = reading
        self.model = model
        self.usage = usage
        self.created_at = created_at or datetime.now(UTC)
        self.updated_at = updated_at or datetime.now(UTC)

    def to_document(self) -> dict[str, Any]:
        doc: dict[str, Any] = {
            "reading_id": ObjectId(self.reading_id),
            "user_id": ObjectId(self.user_id),
            "reading": self.reading,
            "model": self.model,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
        if self.usage is not None:
            doc["usage"] = self.usage
        if self.id:
            doc["_id"] = ObjectId(self.id)
        return doc

    @classmethod
    def from_document(cls, doc: dict[str, Any]) -> "Interpretation":
        return cls(
            id=str(doc["_id"]),
            reading_id=str(doc["reading_id"]),
            user_id=str(doc["user_id"]),
            reading=doc["reading"],
            model=doc["model"],
            usage=doc.get("usage"),
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
        )
