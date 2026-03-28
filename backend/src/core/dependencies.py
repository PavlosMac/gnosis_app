from typing import Annotated

import jwt
from fastapi import Depends, Request

from src.auth.queries.get_user_by_id import GetUserByIdQuery
from src.auth.repository import AuthReadRepository, RefreshTokenRepository
from src.auth.schemas import UserReadModel
from src.auth.service import AuthService
from src.core.exceptions import ForbiddenError, UnauthorizedError
from src.core.security import decode_token
from src.cqrs.mediator import Mediator
from src.database.mongodb import get_database


async def get_db(request: Request):
    return get_database()


async def get_mediator(request: Request) -> Mediator:
    return request.app.state.mediator


def get_refresh_token_repo(request: Request) -> RefreshTokenRepository:
    return request.app.state.refresh_token_repo


async def get_current_user_id(request: Request) -> str:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise UnauthorizedError()
    token = auth_header.removeprefix("Bearer ")
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise UnauthorizedError("Invalid token type")
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise UnauthorizedError()
        return user_id
    except jwt.PyJWTError:
        raise UnauthorizedError()


def get_auth_service(db: "DB", refresh_repo: "RefreshTokenRepoDep") -> AuthService:
    return AuthService(AuthReadRepository(db), refresh_repo)


async def get_current_user(
    user_id: "CurrentUserId",
    mediator: "MediatorDep",
) -> UserReadModel:
    return await mediator.query(GetUserByIdQuery(user_id=user_id))


async def get_current_superadmin(current_user: "CurrentUser") -> UserReadModel:
    if not current_user.is_superadmin:
        raise ForbiddenError("Superadmin access required")
    return current_user


CurrentUserId = Annotated[str, Depends(get_current_user_id)]
DB = Annotated[object, Depends(get_db)]
MediatorDep = Annotated[Mediator, Depends(get_mediator)]
RefreshTokenRepoDep = Annotated[RefreshTokenRepository, Depends(get_refresh_token_repo)]
AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]
CurrentUser = Annotated[UserReadModel, Depends(get_current_user)]
IsSuperAdmin = Annotated[UserReadModel, Depends(get_current_superadmin)]
