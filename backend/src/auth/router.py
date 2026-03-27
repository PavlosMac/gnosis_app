from fastapi import APIRouter, Request

from src.auth.commands.register_user import RegisterUserCommand
from src.auth.schemas import (
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
    MediatorDep,
)

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
