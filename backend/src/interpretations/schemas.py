from datetime import datetime

from pydantic import Field

from src.core.base_schema import AppSchema
from src.core.types import PyObjectId
from src.llm.schemas import InterpretationSettings, Orientation, ReadingStyle

MAX_CONTEXT_LENGTH = 100


class InterpretationSettingsOverride(AppSchema):
    style: ReadingStyle | None = None
    depth: int | None = Field(default=None, ge=0, le=100)
    tone: int | None = Field(default=None, ge=0, le=100)


class GenerateInterpretationRequest(AppSchema):
    settings: InterpretationSettingsOverride | None = None
    context: str | None = Field(default=None, max_length=MAX_CONTEXT_LENGTH)


class CardInterpretationReadModel(AppSchema):
    card_name: str
    position: str
    orientation: Orientation
    interpretation: str


class GeneratedInterpretationResponse(AppSchema):
    card_interpretations: list[CardInterpretationReadModel]
    synthesis: str
    model: str
    tokens_used: int
    settings: InterpretationSettings


class SaveInterpretationRequest(AppSchema):
    card_interpretations: list[CardInterpretationReadModel] = Field(..., min_length=1)
    synthesis: str = Field(..., min_length=1)
    model: str = Field(..., min_length=1)
    tokens_used: int = Field(..., ge=0)
    settings: InterpretationSettings
    context: str | None = Field(default=None, max_length=MAX_CONTEXT_LENGTH)


class InterpretationReadModel(AppSchema):
    id: PyObjectId = Field(alias="_id")
    reading_id: PyObjectId
    user_id: PyObjectId
    card_interpretations: list[CardInterpretationReadModel]
    synthesis: str
    tokens_used: int
    model: str
    settings: InterpretationSettings
    context: str | None = None
    created_at: datetime
    updated_at: datetime
