from datetime import UTC, datetime, timedelta

from src.auth.models import UserStatus, user_status
from src.auth.repository import (
    AuthReadRepository,
    AuthWriteRepository,
    EmailVerificationTokenRepository,
)
from src.auth.service import issue_verification_email
from src.core.config import settings
from src.cqrs.commands import BaseCommand, CommandHandler
from src.notifications.port import EmailPort


class SendVerificationEmailCommand(BaseCommand):
    user_id: str


class SendVerificationEmailHandler(CommandHandler[SendVerificationEmailCommand, None]):
    """The resend work, run after the response has gone out (see
    ResendVerificationHandler). Re-checks the account because time has passed."""

    def __init__(
        self,
        read_repo: AuthReadRepository,
        write_repo: AuthWriteRepository,
        verification_token_repo: EmailVerificationTokenRepository,
        email: EmailPort,
    ) -> None:
        self._read_repo = read_repo
        self._write_repo = write_repo
        self._verification_token_repo = verification_token_repo
        self._email = email

    async def handle(self, command: SendVerificationEmailCommand) -> None:
        doc = await self._read_repo.find_by_id(command.user_id)
        if doc is None or user_status(doc) is not UserStatus.PENDING_VERIFICATION:
            return

        # A user who is still trying must not be purged mid-verification: every resend
        # restarts the purge clock. created_at keeps its meaning.
        deadline = datetime.now(UTC) + timedelta(days=settings.pending_account_ttl_days)
        await self._write_repo.update(command.user_id, {"verification_deadline_at": deadline})

        await issue_verification_email(
            user_id=command.user_id,
            email=doc["email"],
            token_repo=self._verification_token_repo,
            email_port=self._email,
        )
