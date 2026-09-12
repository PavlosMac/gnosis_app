from fastapi import APIRouter

from src.core.dependencies import CurrentUserId, MediatorDep
from src.dashboard.queries.get_dashboard_by_user_id import GetDashboardByUserIdQuery
from src.dashboard.schemas import DashboardResponse

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardResponse)
async def get_dashboard(user_id: CurrentUserId, mediator: MediatorDep) -> DashboardResponse:
    # CurrentUserId decodes the JWT only — the handler does the single users lookup, so
    # the endpoint never loads the user document twice.
    return await mediator.query(GetDashboardByUserIdQuery(user_id=user_id))
