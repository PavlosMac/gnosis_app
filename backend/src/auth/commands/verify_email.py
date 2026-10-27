from datetime import UTC, datetime

from src.auth.repository import AuthWriteRepository, EmailVerificationTokenRepository
from src.auth.service import ExpiredVerificationTokenError, InvalidVerificationTokenError
from src.core.security import ensure_utc, hash_token
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
        # Peek, not consume: the token is retired by the status flip below (and deleted
        # after it), so an invite token posted here cannot burn the invite.
        doc = await self._verification_token_repo.peek(hash_token(command.token))
        if doc is None:
            raise InvalidVerificationTokenError()

        now = datetime.now(UTC)
        if ensure_utc(doc["expires_at"]) < now:
            raise ExpiredVerificationTokenError()

        user_id: str = doc["user_id"]
        if not await self._write_repo.mark_email_verified(user_id, now):
            # Purged (never-verified TTL), deleted, already confirmed, or not a sign-up
            # account at all (an invite token). Same answer as an unknown token —
            # don't reveal which case occurred.
            raise InvalidVerificationTokenError()
        # Used and unused alike: nothing about a confirmed address needs to linger.
        await self._verification_token_repo.delete_all_for_user(user_id)
