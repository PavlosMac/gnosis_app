from datetime import date, datetime

from pydantic import Field, field_validator

from src.core.base_schema import AppSchema
from src.core.types import PyObjectId
from src.interpretations.schemas import InterpretationReadModel
from src.llm.schemas import CardInSpread, Orientation

MAX_TAGS_PER_READING = 5
MAX_TAG_LENGTH = 25


def parse_comma_separated_tags(raw: str) -> list[str]:
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
    cards: list[CardInSpread] = Field(..., min_length=1, max_length=12)


class UpdateReadingTagsRequest(AppSchema):
    tags: list[str]

    @field_validator("tags", mode="before")
    @classmethod
    def validate_tags(cls, value: str) -> list[str]:
        if not isinstance(value, str):
            raise ValueError("tags must be a comma-separated string")
        parsed = parse_comma_separated_tags(value)
        if len(parsed) > MAX_TAGS_PER_READING:
            raise ValueError(f"A reading can have at most {MAX_TAGS_PER_READING} tags")
        for tag in parsed:
            if len(tag) > MAX_TAG_LENGTH:
                raise ValueError(f"Each tag must be at most {MAX_TAG_LENGTH} characters")
        return parsed


class CardReadModel(AppSchema):
    name: str
    position: str
    orientation: Orientation
    position_description: str | None = None


class ReadingReadModel(AppSchema):
    id: PyObjectId = Field(alias="_id")
    user_id: PyObjectId
    spread_type: str
    question: str | None = None
    birth_date: date | None = None
    tags: list[str] = Field(default_factory=list)
    cards: list[CardReadModel]
    interpretations: list[InterpretationReadModel] = Field(default_factory=list)
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
