from pydantic import Field

from src.auth.schemas import UserIdentity
from src.core.base_schema import AppSchema
from src.readings.schemas import ReadingReadModel, TagSummary


class DashboardResponse(AppSchema):
    """Everything the dashboard renders in one call. `budget_usd` is the cap and
    `remaining_budget_usd` what is left of it, both from the same helpers the generate
    endpoint reports through. `last_reading` is the same shape as GET /readings/{id},
    interpretation included, so the front-end can reuse the reading component unchanged.
    `user_tags` is the same vocabulary the readings list carries (most-used first)."""

    user: UserIdentity
    budget_usd: float
    remaining_budget_usd: float
    total_readings: int
    last_reading: ReadingReadModel | None = None
    user_tags: list[TagSummary] = Field(default_factory=list)
