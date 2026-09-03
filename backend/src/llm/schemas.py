from datetime import date
from enum import StrEnum

from pydantic import BaseModel, Field

# The only two spread names the backend special-cases (system-prompt variants).
SIGNIFICATORS_SPREAD = "Significators"
TREE_OF_LIFE_SPREAD = "Tree of Life"


class Orientation(StrEnum):
    upright = "upright"
    reversed = "reversed"


class CardInSpread(BaseModel):
    model_config = {"frozen": True}

    name: str = Field(..., max_length=100)
    position: str | None = Field(
        default=None,
        max_length=100,
        description="Spread position name. Omitted for spreads whose cards are read by order.",
    )
    orientation: Orientation
    position_description: str | None = Field(
        default=None,
        max_length=500,
        description="What this position represents in the spread (e.g. 'Will, drive, and what "
        "energises the situation'). Sent by the frontend to give the LLM interpretive context.",
    )


class InterpretationRequest(BaseModel):
    model_config = {"frozen": True}

    spread_name: str = Field(..., min_length=1, max_length=100)
    question: str | None = Field(default=None, min_length=5, max_length=500)
    birth_date: date | None = Field(default=None)
    cards: list[CardInSpread] = Field(..., min_length=1, max_length=12)


class LeanReading(BaseModel):
    """Schema sent to OpenAI as response_format — not exposed in the API."""

    reading: str = Field(
        ...,
        description=(
            "The complete reading as one continuous narrative that weaves every card in, "
            "at the length the system prompt sets."
        ),
    )


class LLMUsage(BaseModel):
    """Token usage split reported by the provider for one call."""

    model_config = {"frozen": True}

    prompt_tokens: int = 0
    completion_tokens: int = 0
    reasoning_tokens: int = 0


class InterpretationResponse(BaseModel):
    model_config = {"frozen": True}

    reading: str
    model: str
    usage: LLMUsage
