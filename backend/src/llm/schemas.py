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
    cards: list[CardInSpread] = Field(..., min_length=1, max_length=10)


class InterpretationResponse(BaseModel):
    model_config = {"frozen": True}

    interpretation: str
    model: str
    tokens_used: int
