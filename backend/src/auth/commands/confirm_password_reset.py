from datetime import UTC, datetime

from src.auth.repository import (
    AuthReadRepository,
    AuthWriteRepository,
    PasswordResetTokenRepository,
    RefreshTokenRepository,
)
from src.auth.service import ExpiredPasswordResetTokenError, InvalidPasswordResetTokenError
from src.core.password_policy import (
    validate_password_is_not_personal,
    validate_password_strength,
)
from src.core.security import hash_password, hash_token
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
        read_repo: AuthReadRepository,
    ) -> None:
        self._read_repo = read_repo
        self._write_repo = write_repo
        self._reset_token_repo = reset_token_repo
        self._refresh_token_repo = refresh_token_repo

    async def handle(self, command: ConfirmPasswordResetCommand) -> None:
        # Policy first, so a refused password never burns the single-use link. The
        # strength rules need nothing but the password (and so say nothing about the
        # token); the name/email rule needs the account, read through the unconsumed
        # token.
        validate_password_strength(command.new_password)
        token_hash = hash_token(command.token)
        pending = await self._reset_token_repo.peek(token_hash)
        if pending is not None:
            user = await self._read_repo.find_by_id(pending["user_id"])
            if user is not None:
                validate_password_is_not_personal(
                    command.new_password,
                    email=user.get("email"),
                    first_name=user.get("first_name"),
                    last_name=user.get("last_name"),
                )

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
