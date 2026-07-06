from datetime import UTC, date, datetime
from typing import Any

from bson import ObjectId


class Reading:
    def __init__(
        self,
        user_id: str,
        spread_type: str,
        cards: list[dict[str, Any]],
        card_interpretations: list[dict[str, Any]],
        synthesis: str,
        tokens_used: int,
        model: str,
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
        self.tags = tags
        self.cards = cards
        self.card_interpretations = card_interpretations
        self.synthesis = synthesis
        self.tokens_used = tokens_used
        self.model = model
        self.created_at = created_at or datetime.now(UTC)

    def to_document(self) -> dict[str, Any]:
        doc: dict[str, Any] = {
            "user_id": ObjectId(self.user_id),
            "spread_type": self.spread_type,
            "cards": self.cards,
            "card_interpretations": self.card_interpretations,
            "synthesis": self.synthesis,
            "tokens_used": self.tokens_used,
            "model": self.model,
            "created_at": self.created_at,
        }
        if self.id:
            doc["_id"] = ObjectId(self.id)
        if self.question is not None:
            doc["question"] = self.question
        if self.birth_date is not None:
            doc["birth_date"] = self.birth_date.isoformat()
        if self.tags is not None:
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
            card_interpretations=doc["card_interpretations"],
            synthesis=doc["synthesis"],
            tokens_used=doc["tokens_used"],
            model=doc["model"],
            created_at=doc.get("created_at"),
        )
