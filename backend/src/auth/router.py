from fastapi import APIRouter, Query, Request

from src.auth.commands.register_user import RegisterUserCommand
from src.auth.queries.list_users import ListUsersQuery
from src.auth.schemas import (
    AdminUserResponse,
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from src.core.dependencies import (
    AuthServiceDep,
    CurrentUser,
    CurrentUserId,
    IsSuperAdmin,
    MediatorDep,
)
from src.core.pagination import PaginatedResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(
    body: RegisterRequest, mediator: MediatorDep, service: AuthServiceDep
) -> TokenResponse:
    command = RegisterUserCommand(
        email=body.email,
        password=body.password,
        display_name=body.display_name,
    )
    user_id = await mediator.send(command)
    return service.create_tokens_for_user(user_id)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, service: AuthServiceDep) -> TokenResponse:
    return await service.authenticate(body.email, body.password)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshTokenRequest, service: AuthServiceDep) -> TokenResponse:
    return await service.refresh_tokens(body.refresh_token)


@router.post("/logout")
async def logout(
    request: Request,
    user_id: CurrentUserId,
    service: AuthServiceDep,
) -> dict:
    token = request.headers["Authorization"].removeprefix("Bearer ")
    await service.revoke_token(token, user_id)
    return {"detail": "Logged out"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(current_user.model_dump(by_alias=True))


@router.get("/users", response_model=PaginatedResponse[AdminUserResponse])
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
