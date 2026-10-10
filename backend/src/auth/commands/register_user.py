from datetime import UTC, datetime, timedelta
from typing import Any

from src.auth.models import User, UserStatus
from src.auth.repository import (
    AuthReadRepository,
    AuthWriteRepository,
    EmailVerificationTokenRepository,
    ThrottleRepository,
)
from src.auth.service import (
    EmailAlreadyExistsError,
    TooManyRegistrationsError,
    issue_verification_email,
)
from src.core.config import settings
from src.core.password_policy import validate_new_password
from src.core.security import hash_password
from src.cqrs.commands import BaseCommand, CommandHandler
from src.notifications.port import EmailPort


class RegisterUserCommand(BaseCommand):
    email: str
    password: str
    first_name: str
    last_name: str
    # Accepted legal-document versions; each is stamped with accepted_at = now.
    terms_version: str
    privacy_version: str
    # Throttle key. None (scripts, handler-level tests) skips the per-IP limit.
    client_ip: str | None = None


class RegisterUserHandler(CommandHandler[RegisterUserCommand, str]):
    def __init__(
        self,
        write_repo: AuthWriteRepository,
        read_repo: AuthReadRepository,
        verification_token_repo: EmailVerificationTokenRepository,
        email: EmailPort,
        throttle_repo: ThrottleRepository,
    ) -> None:
        self._write_repo = write_repo
        self._read_repo = read_repo
        self._verification_token_repo = verification_token_repo
        self._email = email
        self._throttle_repo = throttle_repo

    async def handle(self, command: RegisterUserCommand) -> str:
        if command.client_ip is not None and await self._throttle_repo.is_over_limit(
            command.client_ip,
            settings.register_rate_limit_window_seconds,
            settings.register_rate_limit_max_attempts,
        ):
            raise TooManyRegistrationsError()

        email = command.email.strip().lower()
        existing = await self._read_repo.find_by_email(email)
        if existing:
            raise EmailAlreadyExistsError()

        first_name = command.first_name.strip()
        last_name = command.last_name.strip()
        validate_new_password(
            command.password, email=email, first_name=first_name, last_name=last_name
        )
        now = datetime.now(UTC)
        consents: dict[str, dict[str, Any]] = {
            "terms": {"version": command.terms_version, "accepted_at": now},
            "privacy": {"version": command.privacy_version, "accepted_at": now},
        }

        user = User(
            email=email,
            password_hash=hash_password(command.password),
            # Every existing consumer reads display_name, so derive it rather than
            # make them all learn first/last.
            display_name=f"{first_name} {last_name}",
            first_name=first_name,
            last_name=last_name,
            consents=consents,
            # No session until the emailed link is confirmed (hard gate).
            status=UserStatus.PENDING_VERIFICATION,
            verification_deadline_at=now + timedelta(days=settings.pending_account_ttl_days),
            created_at=now,
            updated_at=now,
        )
        user_id = await self._write_repo.insert(user.to_document())

        await issue_verification_email(
            user_id=user_id,
            email=email,
            token_repo=self._verification_token_repo,
            email_port=self._email,
        )
        return user_id
