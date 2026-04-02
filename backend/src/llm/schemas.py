from enum import StrEnum

from pydantic import BaseModel, Field


class Orientation(StrEnum):
    upright = "upright"
    reversed = "reversed"


class CardInSpread(BaseModel):
    model_config = {"frozen": True}

    name: str
    position: str
    orientation: Orientation


class InterpretationRequest(BaseModel):
    model_config = {"frozen": True}

    question: str = Field(..., min_length=5, max_length=500)
    cards: list[CardInSpread] = Field(..., min_length=1, max_length=3)


class CardInterpretation(BaseModel):
    """Per-card interpretation returned by the LLM."""

    model_config = {"frozen": True}

    card_name: str
    position: str
    orientation: Orientation
    interpretation: str


class LLMInterpretationResult(BaseModel):
    """Schema sent to OpenAI as response_format — not exposed in the API."""

    card_interpretations: list[CardInterpretation]
    synthesis: str


class InterpretationResponse(BaseModel):
    model_config = {"frozen": True}

    card_interpretations: list[CardInterpretation]
    synthesis: str
    model: str
    tokens_used: int
