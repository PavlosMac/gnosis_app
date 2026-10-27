import asyncio

import structlog

from src.auth.repository import (
    AuthReadRepository,
    AuthWriteRepository,
    EmailVerificationTokenRepository,
    PasswordResetTokenRepository,
    RefreshTokenRepository,
    ThrottleRepository,
)
from src.cqrs.commands import BaseCommand, CommandHandler
from src.interpretations.repository import InterpretationWriteRepository
from src.readings.repository import ReadingWriteRepository, UserTagsWriteRepository

logger = structlog.stdlib.get_logger(__name__)


class DeleteUserCommand(BaseCommand):
    user_id: str


class DeleteUserHandler(CommandHandler[DeleteUserCommand, None]):
    """Erasure: removes the account and everything that references it.

    The single deletion path — DELETE /auth/me (self-service, password re-verified by
    the router) and DELETE /users/{id} (superadmin, via AdminDeleteUserHandler) both end
    here, so a step that must run before an account disappears (a future subscription
    cancellation, for instance) is added here once. The collection list mirrors
    docs/reference/database/model-references.md — a new collection that stores a user_id
    must be added here. This handler only deletes; authorisation is the caller's.
    """

    def __init__(
        self,
        read_repo: AuthReadRepository,
        write_repo: AuthWriteRepository,
        refresh_token_repo: RefreshTokenRepository,
        reset_token_repo: PasswordResetTokenRepository,
        verification_token_repo: EmailVerificationTokenRepository,
        throttle_repo: ThrottleRepository,
        reading_write_repo: ReadingWriteRepository,
        interpretation_write_repo: InterpretationWriteRepository,
        user_tags_write_repo: UserTagsWriteRepository,
    ) -> None:
        self._read_repo = read_repo
        self._write_repo = write_repo
        self._refresh_token_repo = refresh_token_repo
        self._reset_token_repo = reset_token_repo
        self._verification_token_repo = verification_token_repo
        self._throttle_repo = throttle_repo
        self._reading_write_repo = reading_write_repo
        self._interpretation_write_repo = interpretation_write_repo
        self._user_tags_write_repo = user_tags_write_repo

    async def handle(self, command: DeleteUserCommand) -> None:
        user_id = command.user_id
        doc = await self._read_repo.find_by_id(user_id)
        if doc is None:
            return

        # Refresh tokens first, so no new access token can be minted. An access token
        # already issued stays valid until it expires on endpoints that only decode
        # the JWT (see docs/reference/auth/registration-verification-and-consent.md, Need to
        # know). The user document goes last: if a step fails midway the account still
        # exists and the delete can simply be repeated. Everything between those two is
        # independent and idempotent, so it runs concurrently rather than 5 round trips.
        await self._refresh_token_repo.revoke_all_for_user(user_id)
        await asyncio.gather(
            self._interpretation_write_repo.delete_all_for_user(user_id),
            self._reading_write_repo.delete_all_for_user(user_id),
            self._user_tags_write_repo.delete_all_for_user(user_id),
            self._reset_token_repo.delete_all_for_user(user_id),
            self._verification_token_repo.delete_all_for_user(user_id),
            self._throttle_repo.delete_for_account(doc["email"], user_id),
        )
        await self._write_repo.delete(user_id)
        logger.info("account deleted", user_id=user_id)
