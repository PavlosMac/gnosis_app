from datetime import date, datetime

from pydantic import Field, field_validator

from src.core.base_schema import AppSchema
from src.core.types import PyObjectId
from src.llm.schemas import CardInSpread, Orientation

MAX_TAGS_PER_READING = 5
MAX_TAG_LENGTH = 15


def normalize_tags(raw: str) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for piece in raw.split(","):
        tag = piece.strip().lower()
        if not tag or tag in seen:
            continue
        seen.add(tag)
        normalized.append(tag)
    return normalized


class CreateReadingRequest(AppSchema):
    spread_name: str = Field(..., min_length=1, max_length=100)
    question: str | None = Field(default=None, min_length=5, max_length=500)
    birth_date: date | None = Field(default=None)
    cards: list[CardInSpread] = Field(..., min_length=1, max_length=10)


class UpdateReadingTagsRequest(AppSchema):
    tags: str

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: str) -> str:
        tags = normalize_tags(value)
        if len(tags) > MAX_TAGS_PER_READING:
            raise ValueError(f"A reading can have at most {MAX_TAGS_PER_READING} tags")
        for tag in tags:
            if len(tag) > MAX_TAG_LENGTH:
                raise ValueError(f"Each tag must be at most {MAX_TAG_LENGTH} characters")
        return value

    @property
    def normalized_tags(self) -> list[str]:
        return normalize_tags(self.tags)


class CardInterpretationReadModel(AppSchema):
    card_name: str
    position: str
    orientation: Orientation
    interpretation: str


class CardReadModel(AppSchema):
    name: str
    position: str
    orientation: Orientation


class ReadingReadModel(AppSchema):
    id: PyObjectId = Field(alias="_id")
    user_id: PyObjectId
    spread_type: str
    question: str | None = None
    birth_date: date | None = None
    tags: list[str] = Field(default_factory=list)
    cards: list[CardReadModel]
    card_interpretations: list[CardInterpretationReadModel]
    synthesis: str
    tokens_used: int
    model: str
    created_at: datetime


class ReadingListItem(AppSchema):
    id: PyObjectId = Field(alias="_id")
    user_id: PyObjectId
    spread_type: str
    question: str | None = None
    birth_date: date | None = None
    tags: list[str] = Field(default_factory=list)
    cards: list[CardReadModel]
    created_at: datetime
