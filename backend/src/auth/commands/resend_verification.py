from src.auth.models import UserStatus, user_status
from src.auth.repository import AuthReadRepository, ThrottleRepository
from src.auth.service import TooManyVerificationRequestsError
from src.core.config import settings
from src.cqrs.commands import BaseCommand, CommandHandler


class ResendVerificationCommand(BaseCommand):
    email: str


class ResendVerificationHandler(CommandHandler[ResendVerificationCommand, str | None]):
    """Decides whether a new verification mail is owed, and nothing more.

    Returns the user id when the account is pending, else None; the router answers the
    same 200 either way and hands a returned id to SendVerificationEmailCommand as a
    background task. Keeping the token write and the provider call off the request path
    is what makes the three branches (unknown, active, pending) take the same time."""

    def __init__(self, read_repo: AuthReadRepository, throttle_repo: ThrottleRepository) -> None:
        self._read_repo = read_repo
        self._throttle_repo = throttle_repo

    async def handle(self, command: ResendVerificationCommand) -> str | None:
        email = command.email.strip().lower()
        # Throttle before the lookup, recording every call — identical behaviour for
        # known and unknown emails keeps the 429 from leaking account existence.
        if await self._throttle_repo.is_over_limit(
            email,
            settings.password_reset_rate_limit_window_seconds,
            settings.password_reset_rate_limit_max_attempts,
        ):
            raise TooManyVerificationRequestsError()

        doc = await self._read_repo.find_by_email(email)
        if doc is None or user_status(doc) is not UserStatus.PENDING_VERIFICATION:
            return None
        return str(doc["_id"])
