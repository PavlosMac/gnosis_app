from datetime import UTC, datetime, timedelta

import structlog

from src.auth.repository import PasswordResetThrottleRepository
from src.core.config import settings
from src.cqrs.commands import BaseCommand, CommandHandler
from src.notifications.port import EmailPort
from src.support.service import SupportNotConfiguredError, TooManySupportRequestsError

logger = structlog.stdlib.get_logger(__name__)

# Shares the password_reset_attempts collection; the prefix keeps the two limits apart.
_THROTTLE_KEY_PREFIX = "support:"


class ContactSupportCommand(BaseCommand):
    user_id: str
    user_email: str
    subject: str
    message: str


class ContactSupportHandler(CommandHandler[ContactSupportCommand, None]):
    def __init__(self, throttle_repo: PasswordResetThrottleRepository, email: EmailPort) -> None:
        self._throttle_repo = throttle_repo
        self._email = email

    async def handle(self, command: ContactSupportCommand) -> None:
        if not settings.support_email:
            raise SupportNotConfiguredError()

        now = datetime.now(UTC)
        window = timedelta(seconds=settings.support_contact_rate_limit_window_seconds)
        throttle_key = f"{_THROTTLE_KEY_PREFIX}{command.user_id}"

        # Record before counting: count_recent then includes this call's own attempt,
        # so a burst of concurrent requests can only ever over-throttle rather than
        # under-throttle — this endpoint sends email on demand, so err on the side of
        # sending less.
        await self._throttle_repo.record_attempt(throttle_key, expires_at=now + window)
        recent = await self._throttle_repo.count_recent(throttle_key, since=now - window)
        if recent > settings.support_contact_rate_limit_max_attempts:
            raise TooManySupportRequestsError()

        # From stays EMAIL_FROM (DKIM alignment); Reply-To is the user so an inbox
        # reply reaches them. EmailDeliveryError propagates as 502 — unlike
        # forgot-password there is no enumeration concern, and the user must know
        # the message did not go through.
        await self._email.send_support_request(
            to=settings.support_email,
            reply_to=command.user_email,
            subject=command.subject,
            message=command.message,
            user_id=command.user_id,
            submitted_at=now,
        )
        logger.info("support request relayed", user_id=command.user_id)
