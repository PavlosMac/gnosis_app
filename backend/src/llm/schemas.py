from datetime import date
from enum import StrEnum

from pydantic import BaseModel, Field

SIGNIFICATORS_SPREAD = "Significators"


class Orientation(StrEnum):
    upright = "upright"
    reversed = "reversed"


class CardInSpread(BaseModel):
    model_config = {"frozen": True}

    name: str = Field(..., max_length=100)
    position: str = Field(..., max_length=100)
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
    cards: list[CardInSpread] = Field(..., min_length=1, max_length=10)


class CardInterpretation(BaseModel):
    """Per-card interpretation returned by the LLM."""

    model_config = {"frozen": True}

    card_name: str = Field(
        ...,
        description="Exact card name as given in the input spread.",
    )
    position: str = Field(
        ...,
        description="The spread position this card occupies, echoed from the input.",
    )
    orientation: Orientation
    interpretation: str = Field(
        ...,
        description=(
            "A focused interpretation of this card in this position, specific to the "
            "querent's question. Be thorough enough to ground the reading in the card's "
            "symbolism and esoteric correspondences, but concise enough that every sentence "
            "earns its place. Avoid generic textbook definitions and filler."
        ),
    )


class LLMInterpretationResult(BaseModel):
    """Schema sent to OpenAI as response_format — not exposed in the API."""

    card_interpretations: list[CardInterpretation] = Field(
        ...,
        description=(
            "One interpretation per card in the spread, in the same order as the input. "
            "Must contain exactly as many entries as cards provided."
        ),
    )
    synthesis: str = Field(
        ...,
        description=(
            "For multi-card spreads: a cohesive narrative weaving all cards together to "
            "directly address the querent's question. Not a summary of individual cards, "
            "but an integrated insight that reveals something the individual interpretations "
            "alone do not. Match its length to the target word count given in the spread details. "
            "For single-card readings: do not restate the card interpretation. Instead, "
            "offer a practical takeaway — actionable guidance, a reflective question, or a "
            "concrete step the querent can take based on the card's message."
        ),
    )


class InterpretationResponse(BaseModel):
    model_config = {"frozen": True}

    card_interpretations: list[CardInterpretation]
    synthesis: str
    model: str
    tokens_used: int
