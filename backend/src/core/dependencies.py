from typing import Annotated

import jwt
from fastapi import Depends, Request

from src.auth.queries.get_user_by_id import GetUserByIdQuery
from src.auth.read_models import UserReadModel
from src.auth.repository import UserReadRepository
from src.auth.service import AuthService
from src.auth.token_blacklist_repository import TokenBlacklistRepository
from src.core.config import settings
from src.core.exceptions import UnauthorizedError
from src.cqrs.mediator import Mediator
from src.database.mongodb import get_database


async def get_db(request: Request):
    return get_database()


async def get_mediator(request: Request) -> Mediator:
    return request.app.state.mediator


def get_token_blacklist_repo(request: Request) -> TokenBlacklistRepository:
    return request.app.state.token_blacklist_repo


async def get_current_user_id(request: Request) -> str:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise UnauthorizedError()
    token = auth_header.removeprefix("Bearer ")
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        if payload.get("type") != "access":
            raise UnauthorizedError("Invalid token type")
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise UnauthorizedError()

        jti: str | None = payload.get("jti")
        if jti:
            blacklist_repo = get_token_blacklist_repo(request)
            if await blacklist_repo.is_blacklisted(jti):
                raise UnauthorizedError("Token has been revoked")

        return user_id
    except jwt.PyJWTError:
        raise UnauthorizedError()


def get_auth_service(
    db: "DB", blacklist_repo: "TokenBlacklistRepoDep"
) -> AuthService:
    return AuthService(UserReadRepository(db), blacklist_repo)


async def get_current_user(
    user_id: "CurrentUserId",
    mediator: "MediatorDep",
) -> UserReadModel:
    return await mediator.query(GetUserByIdQuery(user_id=user_id))


CurrentUserId = Annotated[str, Depends(get_current_user_id)]
DB = Annotated[object, Depends(get_db)]
MediatorDep = Annotated[Mediator, Depends(get_mediator)]
TokenBlacklistRepoDep = Annotated[
    TokenBlacklistRepository, Depends(get_token_blacklist_repo)
]
AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]
CurrentUser = Annotated[UserReadModel, Depends(get_current_user)]
