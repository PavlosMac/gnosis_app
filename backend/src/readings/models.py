from datetime import UTC, date, datetime
from typing import Any

from bson import ObjectId


class Reading:
    def __init__(
        self,
        user_id: str,
        spread_type: str,
        cards: list[dict[str, Any]],
        question: str | None = None,
        birth_date: date | None = None,
        tags: list[str] | None = None,
        id: str | None = None,
        created_at: datetime | None = None,
    ) -> None:
        self.id = id
        self.user_id = user_id
        self.spread_type = spread_type
        self.question = question
        self.birth_date = birth_date
        self.tags = tags if tags is not None else []
        self.cards = cards
        self.created_at = created_at or datetime.now(UTC)

    def to_document(self) -> dict[str, Any]:
        doc: dict[str, Any] = {
            "user_id": ObjectId(self.user_id),
            "spread_type": self.spread_type,
            "cards": self.cards,
            "created_at": self.created_at,
        }
        if self.id:
            doc["_id"] = ObjectId(self.id)
        if self.question is not None:
            doc["question"] = self.question
        if self.birth_date is not None:
            doc["birth_date"] = self.birth_date.isoformat()
        if self.tags:
            doc["tags"] = self.tags
        return doc

    @classmethod
    def from_document(cls, doc: dict[str, Any]) -> "Reading":
        return cls(
            id=str(doc["_id"]),
            user_id=str(doc["user_id"]),
            spread_type=doc["spread_type"],
            question=doc.get("question"),
            birth_date=date.fromisoformat(doc["birth_date"]) if doc.get("birth_date") else None,
            tags=doc.get("tags", []),
            cards=doc["cards"],
            created_at=doc.get("created_at"),
        )
