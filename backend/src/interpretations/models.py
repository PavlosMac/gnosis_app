from datetime import UTC, datetime
from typing import Any

from bson import ObjectId


class Interpretation:
    def __init__(
        self,
        reading_id: str,
        user_id: str,
        card_interpretations: list[dict[str, Any]],
        synthesis: str,
        tokens_used: int,
        model: str,
        settings: dict[str, Any],
        id: str | None = None,
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
    ) -> None:
        self.id = id
        self.reading_id = reading_id
        self.user_id = user_id
        self.card_interpretations = card_interpretations
        self.synthesis = synthesis
        self.tokens_used = tokens_used
        self.model = model
        self.settings = settings
        self.created_at = created_at or datetime.now(UTC)
        self.updated_at = updated_at or datetime.now(UTC)

    def to_document(self) -> dict[str, Any]:
        doc: dict[str, Any] = {
            "reading_id": ObjectId(self.reading_id),
            "user_id": ObjectId(self.user_id),
            "card_interpretations": self.card_interpretations,
            "synthesis": self.synthesis,
            "tokens_used": self.tokens_used,
            "model": self.model,
            "settings": self.settings,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
        if self.id:
            doc["_id"] = ObjectId(self.id)
        return doc

    @classmethod
    def from_document(cls, doc: dict[str, Any]) -> "Interpretation":
        return cls(
            id=str(doc["_id"]),
            reading_id=str(doc["reading_id"]),
            user_id=str(doc["user_id"]),
            card_interpretations=doc["card_interpretations"],
            synthesis=doc["synthesis"],
            tokens_used=doc["tokens_used"],
            model=doc["model"],
            settings=doc["settings"],
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
        )
