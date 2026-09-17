import asyncio

from bson import ObjectId
from bson.errors import InvalidId

from src.auth.repository import AuthReadRepository
from src.auth.schemas import UserIdentity
from src.auth.service import effective_budget_usd, remaining_budget_usd
from src.core.exceptions import UnauthorizedError
from src.cqrs.queries import BaseQuery, QueryHandler
from src.dashboard.schemas import DashboardResponse
from src.interpretations.repository import InterpretationReadRepository
from src.readings.repository import ReadingReadRepository, UserTagsReadRepository
from src.readings.schemas import ReadingReadModel, TagSummary


class GetDashboardByUserIdQuery(BaseQuery):
    user_id: str


class GetDashboardByUserIdHandler(QueryHandler[GetDashboardByUserIdQuery, DashboardResponse]):
    """The projected user document, the newest reading, the reading count, and the tag
    vocabulary run concurrently, each a single index seek — users by _id, readings by
    (user_id, created_at desc), user_tags by its unique user_id; the interpretation
    follows once the newest reading's id is known, through the same
    InterpretationReadRepository join GET /readings/{id} uses. The count is computed
    live rather than kept as a counter on the user document, so it can never drift."""

    def __init__(
        self,
        user_read_repo: AuthReadRepository,
        reading_read_repo: ReadingReadRepository,
        user_tags_read_repo: UserTagsReadRepository,
        interpretation_read_repo: InterpretationReadRepository,
    ) -> None:
        self._user_read_repo = user_read_repo
        self._reading_read_repo = reading_read_repo
        self._user_tags_read_repo = user_tags_read_repo
        self._interpretation_read_repo = interpretation_read_repo

    async def handle(self, query: GetDashboardByUserIdQuery) -> DashboardResponse:
        # Guard once before the gather — the repos below call ObjectId(user_id) bare, so
        # a malformed id must resolve to the same 401 a missing user does, not a 500.
        try:
            ObjectId(query.user_id)
        except InvalidId:
            raise UnauthorizedError("User not found") from None
        user, latest, total, user_tags_doc = await asyncio.gather(
            self._user_read_repo.find_dashboard_fields(query.user_id),
            self._reading_read_repo.find_latest_by_user_id(query.user_id),
            self._reading_read_repo.count_by_user_id(query.user_id),
            self._user_tags_read_repo.find_by_user_id(query.user_id),
        )
        # An access token can outlive the account it was issued for — auth problem,
        # same posture as GenerateInterpretationHandler.
        if user is None:
            raise UnauthorizedError("User not found")
        if latest is not None:
            latest["interpretation"] = await self._interpretation_read_repo.find_by_reading_id(
                str(latest["_id"])
            )
        budget = effective_budget_usd(user)
        return DashboardResponse(
            user=UserIdentity.model_validate(user),
            budget_usd=budget,
            remaining_budget_usd=remaining_budget_usd(user, budget),
            total_readings=total,
            last_reading=ReadingReadModel.model_validate(latest) if latest else None,
            user_tags=[
                TagSummary.model_validate(tag) for tag in (user_tags_doc or {}).get("tags", [])
            ],
        )
