from datetime import datetime

from pydantic import Field

from src.core.base_schema import AppSchema
from src.core.types import PyObjectId
from src.llm.schemas import InterpretationSettings, Orientation


class GenerateInterpretationRequest(AppSchema):
    # No defaults: the frontend always sends all three, so stored settings always reflect
    # what the user actually chose rather than a server-side fallback.
    settings: InterpretationSettings


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


class InterpretationReadModel(AppSchema):
    id: PyObjectId = Field(alias="_id")
    reading_id: PyObjectId
    user_id: PyObjectId
    card_interpretations: list[CardInterpretationReadModel]
    synthesis: str
    tokens_used: int
    model: str
    settings: InterpretationSettings
    created_at: datetime
    updated_at: datetime


class InterpretationsResponse(AppSchema):
    """Every saved slot for a reading — returned by the upsert so the client
    refreshes without a second GET."""

    interpretations: list[InterpretationReadModel]
