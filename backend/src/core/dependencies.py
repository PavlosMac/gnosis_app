import asyncio
from typing import TYPE_CHECKING, Annotated

import jwt
from fastapi import Depends, Request
from motor.motor_asyncio import AsyncIOMotorDatabase

if TYPE_CHECKING:
    from src.llm.port import LLMPort
    from src.notifications.port import EmailPort

from src.auth.queries.get_user_by_id import GetUserByIdQuery
from src.auth.repository import AuthReadRepository, RefreshTokenRepository, ThrottleRepository
from src.auth.schemas import UserReadModel
from src.auth.service import AuthService, assert_may_hold_session
from src.core.config import settings
from src.core.exceptions import ForbiddenError, NotFoundError, UnauthorizedError
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


class AccessClaims:
    __slots__ = ("user_id", "family_id")

    def __init__(self, user_id: str, family_id: str) -> None:
        self.user_id = user_id
        self.family_id = family_id


async def get_access_claims(request: Request) -> AccessClaims:
    """Decode the bearer token. Stateless: does not check that the session is live."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise UnauthorizedError()
    token = auth_header.removeprefix("Bearer ")
    try:
        payload = decode_token(token)
    except jwt.PyJWTError:
        raise UnauthorizedError()
    if payload.get("type") != "access":
        raise UnauthorizedError("Invalid token type")
    user_id: str | None = payload.get("sub")
    family_id: str | None = payload.get("family_id")
    if user_id is None or family_id is None:
        raise UnauthorizedError()
    return AccessClaims(user_id, family_id)


AccessClaimsDep = Annotated[AccessClaims, Depends(get_access_claims)]


async def get_current_user_id(claims: AccessClaimsDep, refresh_repo: RefreshTokenRepoDep) -> str:
    # The JWT is stateless, so on its own it would outlive logout, a password reset and
    # refresh-replay detection. Tying it to its refresh family makes ending the session
    # end the access token too.
    if not await refresh_repo.family_is_live(claims.family_id):
        raise UnauthorizedError()
    return claims.user_id


CurrentUserId = Annotated[str, Depends(get_current_user_id)]


def get_client_ip(request: Request) -> str:
    """The address rate limits are keyed on. Every request reaches the API through the
    Next.js server, so the socket peer is that server for all users; it forwards the
    browser's address in X-Forwarded-For, whose first entry is the original client."""
    if settings.rate_limit_trust_forwarded_for:
        forwarded = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        if forwarded:
            return forwarded
    return request.client.host if request.client else "unknown"


ClientIp = Annotated[str, Depends(get_client_ip)]


def get_auth_service(db: DB, refresh_repo: RefreshTokenRepoDep) -> AuthService:
    return AuthService(
        AuthReadRepository(db), refresh_repo, ThrottleRepository(db, key_prefix="login:")
    )


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


async def get_current_user(
    claims: AccessClaimsDep,
    refresh_repo: RefreshTokenRepoDep,
    mediator: MediatorDep,
) -> UserReadModel:
    # The session check and the user lookup are independent, so they run together
    # rather than as two serial round trips.
    live, user_result = await asyncio.gather(
        refresh_repo.family_is_live(claims.family_id),
        mediator.query(GetUserByIdQuery(user_id=claims.user_id)),
        return_exceptions=True,
    )
    if isinstance(live, BaseException):
        raise live
    if not live:
        raise UnauthorizedError()
    if isinstance(user_result, NotFoundError):
        # A valid token for an account that no longer exists (deleted or purged) is
        # not a session.
        raise UnauthorizedError()
    if isinstance(user_result, BaseException):
        raise user_result
    user = user_result
    assert_may_hold_session(user.status)
    return user


CurrentUser = Annotated[UserReadModel, Depends(get_current_user)]


async def get_current_superadmin(current_user: CurrentUser) -> UserReadModel:
    if not current_user.is_superadmin:
        raise ForbiddenError("Superadmin access required")
    return current_user


IsSuperAdmin = Annotated[UserReadModel, Depends(get_current_superadmin)]


def get_llm(request: Request) -> "LLMPort":
    return request.app.state.llm


LLMDep = Annotated["LLMPort", Depends(get_llm)]


def get_email(request: Request) -> "EmailPort":
    return request.app.state.email


EmailDep = Annotated["EmailPort", Depends(get_email)]
