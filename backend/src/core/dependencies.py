from typing import TYPE_CHECKING, Annotated

import jwt
from fastapi import Depends, Request
from motor.motor_asyncio import AsyncIOMotorDatabase

if TYPE_CHECKING:
    from src.llm.port import LLMPort

from src.auth.queries.get_user_by_id import GetUserByIdQuery
from src.auth.repository import AuthReadRepository, RefreshTokenRepository
from src.auth.schemas import UserReadModel
from src.auth.service import AuthService
from src.core.exceptions import ForbiddenError, UnauthorizedError
from src.core.security import decode_token
from src.cqrs.mediator import Mediator
from src.database.mongodb import get_database


async def get_db(request: Request) -> AsyncIOMotorDatabase:
    return get_database()


DB = Annotated[AsyncIOMotorDatabase, Depends(get_db)]


async def get_mediator(request: Request) -> Mediator:
    return request.app.state.mediator


MediatorDep = Annotated[Mediator, Depends(get_mediator)]


def get_refresh_token_repo(request: Request) -> RefreshTokenRepository:
    return request.app.state.refresh_token_repo


RefreshTokenRepoDep = Annotated[RefreshTokenRepository, Depends(get_refresh_token_repo)]


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


CurrentUserId = Annotated[str, Depends(get_current_user_id)]


def get_auth_service(db: DB, refresh_repo: RefreshTokenRepoDep) -> AuthService:
    return AuthService(AuthReadRepository(db), refresh_repo)


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


async def get_current_user(
    user_id: CurrentUserId,
    mediator: MediatorDep,
) -> UserReadModel:
    return await mediator.query(GetUserByIdQuery(user_id=user_id))


CurrentUser = Annotated[UserReadModel, Depends(get_current_user)]


async def get_current_superadmin(current_user: CurrentUser) -> UserReadModel:
    if not current_user.is_superadmin:
        raise ForbiddenError("Superadmin access required")
    return current_user


IsSuperAdmin = Annotated[UserReadModel, Depends(get_current_superadmin)]


def get_llm(request: Request) -> "LLMPort":
    return request.app.state.llm


LLMDep = Annotated["LLMPort", Depends(get_llm)]
