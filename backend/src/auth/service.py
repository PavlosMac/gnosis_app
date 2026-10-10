import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
import structlog

from src.auth.models import User, UserStatus, user_status
from src.auth.repository import (
    AuthReadRepository,
    AuthWriteRepository,
    OneTimeTokenRepository,
    RefreshTokenRepository,
    ThrottleRepository,
)
from src.auth.schemas import TokenResponse
from src.core.config import settings as app_settings
from src.core.exceptions import AppError, ConflictError, ForbiddenError, UnauthorizedError
from src.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_url_token,
    hash_token,
    verify_password,
)
from src.notifications.errors import EmailDeliveryError
from src.notifications.port import EmailPort

logger = structlog.stdlib.get_logger(__name__)


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


class InvalidPasswordResetTokenError(AppError):
    def __init__(self) -> None:
        super().__init__(status_code=400, detail="Invalid or already used reset token")


class ExpiredPasswordResetTokenError(AppError):
    def __init__(self) -> None:
        super().__init__(status_code=410, detail="Reset link has expired")


class TooManyPasswordResetRequestsError(AppError):
    def __init__(self) -> None:
        super().__init__(
            status_code=429,
            detail="Too many password reset requests, please try again later",
        )


class EmailNotVerifiedError(ForbiddenError):
    def __init__(self) -> None:
        super().__init__(
            detail="Please confirm your email address before signing in",
            code="email_not_verified",
        )


class InvalidVerificationTokenError(AppError):
    def __init__(self) -> None:
        super().__init__(status_code=400, detail="Invalid or already used verification link")


class ExpiredVerificationTokenError(AppError):
    def __init__(self) -> None:
        super().__init__(status_code=410, detail="Verification link has expired")


class TooManyVerificationRequestsError(AppError):
    def __init__(self) -> None:
        super().__init__(
            status_code=429,
            detail="Too many verification requests, please try again later",
        )


class InvalidPasswordError(ForbiddenError):
    """Re-authentication for a destructive action failed. 403, not 401: the caller is
    authenticated, and clients treat a 401 as an expired session to refresh and retry."""

    def __init__(self) -> None:
        super().__init__(detail="Incorrect password", code="invalid_password")


class TooManyLoginAttemptsError(AppError):
    def __init__(self) -> None:
        super().__init__(status_code=429, detail="Too many login attempts, please try again later")


class TooManyRegistrationsError(AppError):
    def __init__(self) -> None:
        super().__init__(
            status_code=429, detail="Too many registration attempts, please try again later"
        )


# The single extension point for onboarding states: a status may hold a session (log
# in, refresh, call authenticated endpoints) only if it is listed here. A later
# payment step adds PAYMENT_REQUIRED (they must log in to pay) and nothing else moves.
SESSION_STATUSES: frozenset[UserStatus] = frozenset({UserStatus.ACTIVE})


def assert_may_hold_session(status: UserStatus) -> None:
    """Called on login (after the password check, so the 403 is not an existence
    oracle), on refresh, and by get_current_user."""
    if status not in SESSION_STATUSES:
        raise EmailNotVerifiedError()


async def issue_verification_email(
    *,
    user_id: str,
    email: str,
    token_repo: OneTimeTokenRepository,
    email_port: EmailPort,
) -> None:
    """Rotate the user's verification token and mail the link. Shared by registration
    and resend. Only the hash is stored; older links stop working."""
    raw_token = generate_url_token()
    ttl = timedelta(hours=app_settings.email_verification_token_ttl_hours)
    await token_repo.invalidate_all_for_user(user_id)
    await token_repo.store(hash_token(raw_token), user_id, expires_at=datetime.now(UTC) + ttl)

    verify_link = f"{app_settings.frontend_base_url}/verify-email?token={raw_token}"
    try:
        await email_port.send_email_verification(to=email, verify_link=verify_link)
    except EmailDeliveryError:
        # Log and carry on: the account already exists, so a 5xx would leave it
        # half-created and 409 on retry. Resend is the recovery path.
        logger.error("verification email delivery failed", user_id=user_id, exc_info=True)


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
        login_throttle: ThrottleRepository,
    ) -> None:
        self._read_repo = read_repo
        self._refresh_repo = refresh_repo
        self._login_throttle = login_throttle

    async def authenticate(self, email: str, password: str, client_ip: str) -> TokenResponse:
        # Throttle before the lookup so the 429 is identical for known and unknown
        # emails. Keyed by IP + email together: by email alone an attacker could lock
        # the owner out; by IP alone one address could try every account.
        throttle_key = f"{client_ip}:{email.strip().lower()}"
        if await self._login_throttle.is_over_limit(
            throttle_key,
            app_settings.login_rate_limit_window_seconds,
            app_settings.login_rate_limit_max_attempts,
        ):
            raise TooManyLoginAttemptsError()

        doc = await self._read_repo.find_by_email(email)
        if doc is None:
            raise InvalidCredentialsError()

        user = User.from_document(doc)
        if not verify_password(password, user.password_hash):
            raise InvalidCredentialsError()

        # After the password check: only someone who holds the password learns that
        # the account exists and is unverified.
        assert_may_hold_session(user.status)

        return await self._create_and_store_tokens(str(doc["_id"]), family_id=str(uuid.uuid4()))

    async def confirm_password(self, user_id: str, password: str) -> None:
        """Re-authenticate the logged-in user before a destructive action (account
        deletion). Throttled with the login limits so a stolen access token cannot be
        used to guess the password."""
        if await self._login_throttle.is_over_limit(
            f"delete:{user_id}",
            app_settings.login_rate_limit_window_seconds,
            app_settings.login_rate_limit_max_attempts,
        ):
            raise TooManyLoginAttemptsError()

        doc = await self._read_repo.find_by_id(user_id)
        if doc is None:
            raise UnauthorizedError()
        if not verify_password(password, doc["password_hash"]):
            raise InvalidPasswordError()

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
        assert_may_hold_session(user_status(user_doc))

        return await self._create_and_store_tokens(user_id, family_id)

    async def revoke_token(self, token: str, user_id: str) -> None:
        try:
            payload = decode_token(token)
        except jwt.PyJWTError:
            return

        family_id: str | None = payload.get("family_id")
        if family_id:
            await self._refresh_repo.revoke_family(family_id)

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
