import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import jwt

from src.auth.models import User
from src.auth.repository import AuthReadRepository, AuthWriteRepository, RefreshTokenRepository
from src.auth.schemas import TokenResponse
from src.core.config import settings as app_settings
from src.core.exceptions import AppError, ConflictError, UnauthorizedError
from src.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)


class EmailAlreadyExistsError(ConflictError):
    def __init__(self) -> None:
        super().__init__(detail="A user with this email already exists")


class InvalidCredentialsError(UnauthorizedError):
    def __init__(self) -> None:
        super().__init__(detail="Invalid email or password")


class BudgetExceededError(AppError):
    def __init__(self) -> None:
        super().__init__(
            status_code=402,
            detail="Usage budget exhausted",
        )


def effective_budget_usd(user: dict[str, Any]) -> float:
    """The cap this user is charged against: their per-user override if the field is
    present, else the app default. `or` would treat an explicit override of 0 as unset
    and fall through to the default — a user budget-capped to $0 must actually be
    blocked."""
    user_budget = user.get("budget_usd")
    return user_budget if user_budget is not None else app_settings.user_budget_usd


def remaining_budget_usd(user: dict[str, Any], budget_usd: float | None = None) -> float:
    """Effective budget minus spend so far, floored at 0. The usage aggregate is created
    lazily, so a user with no `usage.cost_usd` yet has spent nothing. Callers that have
    already resolved the budget via effective_budget_usd pass it as `budget_usd`, so both
    figures are guaranteed to derive from the same resolution."""
    spent = (user.get("usage") or {}).get("cost_usd", 0.0)
    budget = budget_usd if budget_usd is not None else effective_budget_usd(user)
    return max(budget - spent, 0.0)


@asynccontextmanager
async def reserve_budget(
    write_repo: AuthWriteRepository, user_id: str, reserved_usd: float, budget_usd: float
) -> AsyncIterator[None]:
    """Reserve `reserved_usd` against the user's budget for the duration of the block,
    releasing it automatically if the block raises for any reason (cancellation
    included) — the user is never charged for work that didn't complete.

    Any feature that spends against the per-user budget (not just interpretations)
    should wrap its paid call in this rather than hand-rolling the reserve/release
    choreography. On success the caller still owns settling the reservation to actuals
    (AuthWriteRepository.settle_usage) — the exact cost is only known once the paid call
    returns, which this context manager has no visibility into.
    """
    if not await write_repo.reserve_usage(user_id, reserved_usd, budget_usd):
        raise BudgetExceededError()
    try:
        yield
    except BaseException:
        await write_repo.release_usage(user_id, reserved_usd)
        raise


class AuthService:
    def __init__(
        self,
        read_repo: AuthReadRepository,
        refresh_repo: RefreshTokenRepository,
    ) -> None:
        self._read_repo = read_repo
        self._refresh_repo = refresh_repo

    async def authenticate(self, email: str, password: str) -> TokenResponse:
        doc = await self._read_repo.find_by_email(email)
        if doc is None:
            raise InvalidCredentialsError()

        user = User.from_document(doc)
        if not verify_password(password, user.password_hash):
            raise InvalidCredentialsError()

        return await self._create_and_store_tokens(user.id, family_id=str(uuid.uuid4()))

    async def refresh_tokens(self, refresh_token: str) -> TokenResponse:
        try:
            payload = decode_token(refresh_token)
        except jwt.PyJWTError:
            raise UnauthorizedError("Invalid refresh token")

        if payload.get("type") != "refresh":
            raise UnauthorizedError("Invalid token type")

        jti: str | None = payload.get("jti")
        family_id: str | None = payload.get("family_id")
        if jti is None or family_id is None:
            raise UnauthorizedError("Invalid refresh token")

        doc = await self._refresh_repo.consume(jti)
        if doc is None:
            await self._refresh_repo.revoke_family(family_id)
            raise UnauthorizedError("Token has been revoked")

        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise UnauthorizedError("Invalid refresh token")

        user_doc = await self._read_repo.find_by_id(user_id)
        if user_doc is None:
            raise UnauthorizedError("User not found")

        return await self._create_and_store_tokens(user_id, family_id)

    async def revoke_token(self, token: str, user_id: str) -> None:
        try:
            payload = decode_token(token)
        except jwt.PyJWTError:
            return

        family_id: str | None = payload.get("family_id")
        if family_id:
            await self._refresh_repo.revoke_family(family_id)

    async def create_tokens_for_user(self, user_id: str) -> TokenResponse:
        return await self._create_and_store_tokens(user_id, family_id=str(uuid.uuid4()))

    async def _create_and_store_tokens(self, user_id: str, family_id: str) -> TokenResponse:
        jti = str(uuid.uuid4())
        access_token, access_expires = create_access_token(user_id, family_id)
        refresh_token, refresh_expires = create_refresh_token(user_id, jti, family_id)
        await self._refresh_repo.store(jti, family_id, user_id, refresh_expires)
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            access_token_expires_at=int(access_expires.timestamp()),
            refresh_token_expires_at=int(refresh_expires.timestamp()),
        )
