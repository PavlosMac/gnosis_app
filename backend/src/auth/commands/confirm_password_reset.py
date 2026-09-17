import hashlib
from datetime import UTC, datetime

from src.auth.repository import (
    AuthWriteRepository,
    PasswordResetTokenRepository,
    RefreshTokenRepository,
)
from src.auth.service import ExpiredPasswordResetTokenError, InvalidPasswordResetTokenError
from src.core.security import hash_password
from src.cqrs.commands import BaseCommand, CommandHandler


class ConfirmPasswordResetCommand(BaseCommand):
    token: str
    new_password: str


class ConfirmPasswordResetHandler(CommandHandler[ConfirmPasswordResetCommand, None]):
    def __init__(
        self,
        write_repo: AuthWriteRepository,
        reset_token_repo: PasswordResetTokenRepository,
        refresh_token_repo: RefreshTokenRepository,
    ) -> None:
        self._write_repo = write_repo
        self._reset_token_repo = reset_token_repo
        self._refresh_token_repo = refresh_token_repo

    async def handle(self, command: ConfirmPasswordResetCommand) -> None:
        token_hash = hashlib.sha256(command.token.encode()).hexdigest()
        doc = await self._reset_token_repo.consume(token_hash)
        if doc is None:
            raise InvalidPasswordResetTokenError()

        # PyMongo returns naive UTC datetimes by default; normalise before comparing.
        expires_at: datetime = doc["expires_at"]
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if expires_at < datetime.now(UTC):
            raise ExpiredPasswordResetTokenError()

        user_id: str = doc["user_id"]
        updated = await self._write_repo.update(
            user_id, {"password_hash": hash_password(command.new_password)}
        )
        if not updated:
            # Token was valid but the user it points to is gone (e.g. deleted between
            # request and confirm) — don't report success for a password that was never set.
            raise InvalidPasswordResetTokenError()
        # Kill every existing session — a reset must lock out whoever held the old
        # password — and clear any remaining reset tokens as defense-in-depth.
        await self._refresh_token_repo.revoke_all_for_user(user_id)
        await self._reset_token_repo.invalidate_all_for_user(user_id)
