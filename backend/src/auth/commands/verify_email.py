from datetime import UTC, datetime

from src.auth.repository import AuthWriteRepository, EmailVerificationTokenRepository
from src.auth.service import ExpiredVerificationTokenError, InvalidVerificationTokenError
from src.core.security import hash_token
from src.cqrs.commands import BaseCommand, CommandHandler


class VerifyEmailCommand(BaseCommand):
    token: str


class VerifyEmailHandler(CommandHandler[VerifyEmailCommand, None]):
    """Confirms the address and activates the account. Issues no tokens: the user
    signs in explicitly afterwards, so a leaked link never yields a session."""

    def __init__(
        self,
        write_repo: AuthWriteRepository,
        verification_token_repo: EmailVerificationTokenRepository,
    ) -> None:
        self._write_repo = write_repo
        self._verification_token_repo = verification_token_repo

    async def handle(self, command: VerifyEmailCommand) -> None:
        doc = await self._verification_token_repo.consume(hash_token(command.token))
        if doc is None:
            raise InvalidVerificationTokenError()

        # PyMongo returns naive UTC datetimes by default; normalise before comparing.
        expires_at: datetime = doc["expires_at"]
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        now = datetime.now(UTC)
        if expires_at < now:
            raise ExpiredVerificationTokenError()

        user_id: str = doc["user_id"]
        if not await self._write_repo.mark_email_verified(user_id, now):
            # The account was purged (never-verified TTL) or deleted. Same answer as
            # an unknown token — don't reveal which case occurred.
            raise InvalidVerificationTokenError()
        # Used and unused alike: nothing about a confirmed address needs to linger.
        await self._verification_token_repo.delete_all_for_user(user_id)
