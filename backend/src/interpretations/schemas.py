from datetime import datetime

from pydantic import Field

from src.core.base_schema import AppSchema
from src.core.types import PyObjectId


class InterpretationUsage(AppSchema):
    """The per-interpretation usage ledger — the answer to "why did my balance drop".

    cost_usd is priced from the config table at the moment of the call and never
    re-derived, so a price-table change doesn't rewrite history. model is the resolved
    id from the provider response (e.g. `gpt-5.4-2026-…`), not the configured alias.
    """

    prompt_tokens: int = Field(..., ge=0)
    completion_tokens: int = Field(..., ge=0)
    reasoning_tokens: int = Field(default=0, ge=0)
    model: str
    cost_usd: float = Field(..., ge=0)


class InterpretationReadModel(AppSchema):
    id: PyObjectId = Field(alias="_id")
    reading_id: PyObjectId
    user_id: PyObjectId
    reading: str
    model: str
    # Absent on documents migrated from before the usage ledger existed.
    usage: InterpretationUsage | None = None
    created_at: datetime
    updated_at: datetime


class GeneratedInterpretationResponse(AppSchema):
    """The one-step generate response: the interpretation is persisted before this is
    returned (the nested object is exactly what GET /readings/{id} embeds), plus the
    caller's remaining budget. A repeat call returns the stored interpretation with the
    budget untouched."""

    interpretation: InterpretationReadModel
    remaining_budget_usd: float
