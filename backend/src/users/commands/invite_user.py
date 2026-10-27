from datetime import UTC, datetime, timedelta

import structlog
from pymongo.errors import DuplicateKeyError

from src.auth.models import User, UserStatus, user_status
from src.auth.repository import (
    AuthReadRepository,
    AuthWriteRepository,
    EmailVerificationTokenRepository,
)
from src.auth.service import EmailAlreadyExistsError, issue_invite_email
from src.core.config import settings
from src.cqrs.commands import BaseCommand, CommandHandler
from src.notifications.port import EmailPort

logger = structlog.stdlib.get_logger(__name__)


class InviteUserCommand(BaseCommand):
    email: str
    admin_id: str


class InviteUserHandler(CommandHandler[InviteUserCommand, str]):
    """Superadmin invites an address. A fresh address gets an invited account (no
    password, names or consents yet) and the link; an address that is already invited
    gets a new link and a new purge deadline, exactly like a verification resend. Any
    other existing account is a 409. Returns the user id."""

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

    async def handle(self, command: InviteUserCommand) -> str:
        email = command.email.strip().lower()
        now = datetime.now(UTC)
        deadline = now + timedelta(days=settings.invite_ttl_days)

        existing = await self._read_repo.find_by_email(email)
        if existing is None:
            user = User(
                email=email,
                password_hash=None,
                status=UserStatus.INVITED,
                verification_deadline_at=deadline,
                created_at=now,
                updated_at=now,
            )
            try:
                user_id = await self._write_repo.insert(user.to_document())
                event = "user invited"
            except DuplicateKeyError:
                # Lost the check-then-insert race (double-click, two admins, or a
                # concurrent sign-up) — the unique email index is the real arbiter.
                # Re-read and treat the winner as the existing account.
                existing = await self._read_repo.find_by_email(email)
                if existing is None:
                    raise EmailAlreadyExistsError() from None

        if existing is not None:
            if user_status(existing) is not UserStatus.INVITED:
                raise EmailAlreadyExistsError()
            user_id = str(existing["_id"])
            # Guarded on status: an accept that lands between the read and here wins,
            # and the stale link is not mailed.
            if not await self._write_repo.extend_invite(user_id, deadline, now):
                raise EmailAlreadyExistsError()
            event = "invite resent"

        # Logged before the send: the account now exists whether or not the mail goes
        # out, and a failed send is its own warning from the exception handler.
        logger.info(event, user_id=user_id, admin_id=command.admin_id)
        # Not a background task: the admin is waiting for the answer, and a failed
        # send (502) is exactly what they need to see to press "resend".
        await issue_invite_email(
            user_id=user_id,
            email=email,
            token_repo=self._verification_token_repo,
            email_port=self._email,
        )
        return user_id
