from datetime import UTC, datetime

import structlog

from src.auth.models import build_consents
from src.auth.repository import (
    AuthReadRepository,
    AuthWriteRepository,
    EmailVerificationTokenRepository,
    ThrottleRepository,
)
from src.auth.service import InvalidInviteTokenError, TooManyInviteRequestsError, load_invite
from src.core.config import settings
from src.core.password_policy import validate_new_password
from src.core.security import hash_password
from src.cqrs.commands import BaseCommand, CommandHandler

logger = structlog.stdlib.get_logger(__name__)


class AcceptInviteCommand(BaseCommand):
    token: str
    password: str
    first_name: str
    last_name: str
    terms_version: str
    privacy_version: str
    # Throttle key. None (handler-level tests) skips the per-IP limit.
    client_ip: str | None = None


class AcceptInviteHandler(CommandHandler[AcceptInviteCommand, None]):
    """The invitee supplies what registration would have asked for and the account
    goes straight to active: opening the emailed link already proved the address.
    Issues no tokens (same stance as verify-email): the user signs in afterwards."""

    def __init__(
        self,
        read_repo: AuthReadRepository,
        write_repo: AuthWriteRepository,
        verification_token_repo: EmailVerificationTokenRepository,
        throttle_repo: ThrottleRepository,
    ) -> None:
        self._read_repo = read_repo
        self._write_repo = write_repo
        self._verification_token_repo = verification_token_repo
        self._throttle_repo = throttle_repo

    async def handle(self, command: AcceptInviteCommand) -> None:
        if command.client_ip is not None and await self._throttle_repo.is_over_limit(
            command.client_ip,
            settings.login_rate_limit_window_seconds,
            settings.login_rate_limit_max_attempts,
        ):
            raise TooManyInviteRequestsError()

        # Validate everything that can be refused before touching state — a refused
        # password must not burn the link.
        _, user_doc = await load_invite(
            command.token, token_repo=self._verification_token_repo, read_repo=self._read_repo
        )
        first_name = command.first_name.strip()
        last_name = command.last_name.strip()
        validate_new_password(
            command.password, email=user_doc["email"], first_name=first_name, last_name=last_name
        )

        now = datetime.now(UTC)
        user_id = str(user_doc["_id"])
        activated = await self._write_repo.activate_invited(
            user_id,
            password_hash=hash_password(command.password),
            first_name=first_name,
            last_name=last_name,
            consents=build_consents(command.terms_version, command.privacy_version, now),
            activated_at=now,
        )
        if not activated:
            # Purged, deleted or accepted concurrently between peek and here.
            raise InvalidInviteTokenError()
        # The token is retired only now that the account is active: the status guard on
        # activate_invited is what makes the link single-use, and a failure above leaves
        # the invitee a working link instead of a burned one.
        await self._verification_token_repo.delete_all_for_user(user_id)
        logger.info("invite accepted", user_id=user_id)
