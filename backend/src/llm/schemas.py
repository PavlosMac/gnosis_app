from datetime import date
from enum import StrEnum

from pydantic import BaseModel, Field

SIGNIFICATORS_SPREAD = "Significators"


class Orientation(StrEnum):
    upright = "upright"
    reversed = "reversed"


class InterpretationLens(StrEnum):
    """How the cards are read. One lens per interpretation — never blended."""

    traditional = "traditional"
    psychological = "psychological"
    esoteric = "esoteric"
    alchemical = "alchemical"


class ReadingIntent(StrEnum):
    """What the reading answers: what is, or what is likely to come."""

    reflective = "reflective"
    predictive = "predictive"


class InterpretationSettings(BaseModel):
    model_config = {"frozen": True}

    lens: InterpretationLens
    intent: ReadingIntent
    depth: int = Field(..., ge=0, le=100)


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
    cards: list[CardInSpread] = Field(..., min_length=1, max_length=12)
    settings: InterpretationSettings


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
            "querent's question and written in the register the system prompt's LENS "
            "block sets. Ground it in the card material supplied. Every sentence must "
            "earn its place: no generic textbook definitions, no filler."
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
            "The synthesis the system prompt's SYNTHESIS section describes, at the length "
            "its OUTPUT section gives. Multi-card spreads: one integrated reading of the "
            "cards together that reveals what the individual interpretations do not — not "
            "a summary. Single-card readings: a practical takeaway, not a restatement of "
            "the card interpretation. Significator charts: a cohesive portrait of the "
            "querent."
        ),
    )


class InterpretationResponse(BaseModel):
    model_config = {"frozen": True}

    card_interpretations: list[CardInterpretation]
    synthesis: str
    model: str
    tokens_used: int
