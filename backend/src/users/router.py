from fastapi import APIRouter, Query, Response

from src.core.dependencies import IsSuperAdmin, MediatorDep
from src.core.pagination import PaginatedResponse
from src.users.commands.admin_delete_user import AdminDeleteUserCommand
from src.users.commands.invite_user import InviteUserCommand
from src.users.commands.send_admin_message import SendAdminMessageCommand
from src.users.queries.list_users import ListUsersQuery
from src.users.schemas import (
    AdminMessageRequest,
    AdminMessageResponse,
    AdminUserResponse,
    InviteRequest,
    InviteResponse,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/invite", response_model=InviteResponse)
async def invite_user(
    body: InviteRequest, admin: IsSuperAdmin, mediator: MediatorDep
) -> InviteResponse:
    """Invite an address, or resend the link to one already invited. Sends on the
    request path on purpose: a delivery failure is a 502 the admin can act on."""
    await mediator.send(InviteUserCommand(email=body.email, admin_id=str(admin.id)))
    return InviteResponse()


@router.post("/{user_id}/email", response_model=AdminMessageResponse)
async def email_user(
    user_id: str, body: AdminMessageRequest, admin: IsSuperAdmin, mediator: MediatorDep
) -> AdminMessageResponse:
    await mediator.send(
        SendAdminMessageCommand(
            user_id=user_id, admin_id=str(admin.id), subject=body.subject, message=body.message
        )
    )
    return AdminMessageResponse()


@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: str, admin: IsSuperAdmin, mediator: MediatorDep) -> Response:
    await mediator.send(AdminDeleteUserCommand(user_id=user_id, admin_id=str(admin.id)))
    return Response(status_code=204)


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
