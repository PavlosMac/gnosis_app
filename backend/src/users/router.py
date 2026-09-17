from fastapi import APIRouter, Query

from src.core.dependencies import IsSuperAdmin, MediatorDep
from src.core.pagination import PaginatedResponse
from src.users.queries.list_users import ListUsersQuery
from src.users.schemas import AdminUserResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=PaginatedResponse[AdminUserResponse])
async def list_users(
    _admin: IsSuperAdmin,
    mediator: MediatorDep,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> PaginatedResponse[AdminUserResponse]:
    result = await mediator.query(ListUsersQuery(page=page, page_size=page_size))
    return PaginatedResponse[AdminUserResponse](
        items=[AdminUserResponse.model_validate(u.model_dump(by_alias=True)) for u in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
    )
