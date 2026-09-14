import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import structlog

from src.auth.repository import (
    AuthReadRepository,
    PasswordResetThrottleRepository,
    PasswordResetTokenRepository,
)
from src.auth.service import TooManyPasswordResetRequestsError
from src.core.config import settings
from src.cqrs.commands import BaseCommand, CommandHandler
from src.notifications.errors import EmailDeliveryError
from src.notifications.port import EmailPort

logger = structlog.stdlib.get_logger(__name__)


class RequestPasswordResetCommand(BaseCommand):
    email: str


class RequestPasswordResetHandler(CommandHandler[RequestPasswordResetCommand, None]):
    def __init__(
        self,
        read_repo: AuthReadRepository,
        reset_token_repo: PasswordResetTokenRepository,
        throttle_repo: PasswordResetThrottleRepository,
        email: EmailPort,
    ) -> None:
        self._read_repo = read_repo
        self._reset_token_repo = reset_token_repo
        self._throttle_repo = throttle_repo
        self._email = email

    async def handle(self, command: RequestPasswordResetCommand) -> None:
        now = datetime.now(UTC)
        window = timedelta(seconds=settings.password_reset_rate_limit_window_seconds)

        # Throttle before the existence check, and record every call (throttled or
        # unknown email alike) — identical behavior for known and unknown emails is
        # what keeps the 429 from leaking account existence.
        recent = await self._throttle_repo.count_recent(command.email, since=now - window)
        await self._throttle_repo.record_attempt(command.email, expires_at=now + window)
        if recent >= settings.password_reset_rate_limit_max_attempts:
            raise TooManyPasswordResetRequestsError()

        user_doc = await self._read_repo.find_by_email(command.email)
        if user_doc is None:
            return  # enumeration-safe no-op

        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        user_id = str(user_doc["_id"])

        # Only one live token per user: a new request supersedes older links.
        await self._reset_token_repo.invalidate_all_for_user(user_id)
        ttl = timedelta(minutes=settings.password_reset_token_ttl_minutes)
        await self._reset_token_repo.store(token_hash, user_id, expires_at=now + ttl)

        reset_link = f"{settings.frontend_base_url}/reset-password?token={raw_token}"
        try:
            await self._email.send_password_reset(to=command.email, reset_link=reset_link)
        except EmailDeliveryError:
            # A provider outage only errors for existing accounts (unknown emails never
            # reach the send), so surfacing it would be an enumeration oracle. Log it;
            # the endpoint answers 200 and the user can retry.
            logger.error("password reset email delivery failed", email=command.email)
