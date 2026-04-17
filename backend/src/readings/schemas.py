from datetime import date, datetime

from pydantic import Field

from src.core.base_schema import AppSchema
from src.core.types import PyObjectId
from src.llm.schemas import CardInSpread, Orientation


class CreateReadingRequest(AppSchema):
    spread_name: str = Field(..., min_length=1, max_length=100)
    question: str | None = Field(default=None, min_length=5, max_length=500)
    birth_date: date | None = Field(default=None)
    cards: list[CardInSpread] = Field(..., min_length=1, max_length=10)


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
    cards: list[CardReadModel]
    created_at: datetime
