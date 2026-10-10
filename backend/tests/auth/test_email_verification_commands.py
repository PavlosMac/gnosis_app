import pytest

from src.auth.commands.register_user import RegisterUserCommand, RegisterUserHandler
from src.auth.commands.resend_verification import (
    ResendVerificationCommand,
    ResendVerificationHandler,
)
from src.auth.commands.send_verification_email import (
    SendVerificationEmailCommand,
    SendVerificationEmailHandler,
)
from src.auth.commands.verify_email import VerifyEmailCommand, VerifyEmailHandler
from src.auth.repository import (
    AuthReadRepository,
    AuthWriteRepository,
    EmailVerificationTokenRepository,
    ThrottleRepository,
)
from src.auth.service import (
    InvalidVerificationTokenError,
    TooManyVerificationRequestsError,
)
from src.core.config import settings
from src.core.security import hash_token
from src.database.collections.constants import EMAIL_VERIFICATION_TOKENS_COLLECTION
from src.notifications.errors import EmailDeliveryError
from src.notifications.mock_adapter import MockEmailAdapter
from tests.factories import verification_token


class FailingVerificationEmail(MockEmailAdapter):
    async def send_email_verification(self, to: str, verify_link: str) -> None:
        raise EmailDeliveryError()


def _register_handler(mock_db, email) -> RegisterUserHandler:
    return RegisterUserHandler(
        AuthWriteRepository(mock_db),
        AuthReadRepository(mock_db),
        EmailVerificationTokenRepository(mock_db),
        email,
        ThrottleRepository(mock_db, key_prefix="register:"),
    )


COMMAND = RegisterUserCommand(
    email="cmd@example.com",
    password="testpassword123",
    first_name="Ada",
    last_name="Lovelace",
    terms_version="2026-10-04",
    privacy_version="2026-10-04",
)


async def test_register_creates_a_pending_user_and_sends_the_link(mock_db):
    email = MockEmailAdapter()

    user_id = await _register_handler(mock_db, email).handle(COMMAND)

    doc = await AuthReadRepository(mock_db).find_by_id(user_id)
    assert doc["status"] == "pending_verification"
    assert len(email.sent_email_verifications) == 1


async def test_verification_token_is_hashed_at_rest(mock_db):
    email = MockEmailAdapter()
    await _register_handler(mock_db, email).handle(COMMAND)

    raw = verification_token(email)
    stored = await mock_db[EMAIL_VERIFICATION_TOKENS_COLLECTION].find().to_list(length=10)

    assert len(stored) == 1
    assert stored[0]["token_hash"] == hash_token(raw)
    assert raw not in str(stored[0])


async def test_register_swallows_delivery_failure_and_user_stays_pending(mock_db):
    """A provider outage must not 5xx: the account exists, a retry would 409, and
    resend is the recovery path."""
    user_id = await _register_handler(mock_db, FailingVerificationEmail()).handle(COMMAND)

    doc = await AuthReadRepository(mock_db).find_by_id(user_id)
    assert doc["status"] == "pending_verification"
    assert await mock_db[EMAIL_VERIFICATION_TOKENS_COLLECTION].count_documents({}) == 1


async def test_verify_activates_the_user_and_removes_tokens(mock_db):
    email = MockEmailAdapter()
    user_id = await _register_handler(mock_db, email).handle(COMMAND)
    handler = VerifyEmailHandler(
        AuthWriteRepository(mock_db), EmailVerificationTokenRepository(mock_db)
    )

    await handler.handle(VerifyEmailCommand(token=verification_token(email)))

    doc = await AuthReadRepository(mock_db).find_by_id(user_id)
    assert doc["status"] == "active"
    assert doc["email_verified_at"] is not None
    assert doc["updated_at"] >= doc["created_at"]
    assert await mock_db[EMAIL_VERIFICATION_TOKENS_COLLECTION].count_documents({}) == 0


async def test_verify_rejects_an_unknown_token(mock_db):
    handler = VerifyEmailHandler(
        AuthWriteRepository(mock_db), EmailVerificationTokenRepository(mock_db)
    )
    with pytest.raises(InvalidVerificationTokenError):
        await handler.handle(VerifyEmailCommand(token="missing"))


async def test_resend_returns_user_id_only_for_a_pending_account(mock_db):
    email = MockEmailAdapter()
    user_id = await _register_handler(mock_db, email).handle(COMMAND)
    handler = ResendVerificationHandler(
        AuthReadRepository(mock_db), ThrottleRepository(mock_db, key_prefix="verify:")
    )

    assert await handler.handle(ResendVerificationCommand(email="cmd@example.com")) == user_id
    assert await handler.handle(ResendVerificationCommand(email="ghost@example.com")) is None

    await AuthWriteRepository(mock_db).update(user_id, {"status": "active"})
    assert await handler.handle(ResendVerificationCommand(email="cmd@example.com")) is None


async def test_resend_throttles_before_the_lookup(mock_db):
    handler = ResendVerificationHandler(
        AuthReadRepository(mock_db), ThrottleRepository(mock_db, key_prefix="verify:")
    )
    command = ResendVerificationCommand(email="ghost@example.com")
    for _ in range(settings.password_reset_rate_limit_max_attempts):
        await handler.handle(command)

    with pytest.raises(TooManyVerificationRequestsError):
        await handler.handle(command)


async def test_send_verification_email_skips_a_user_who_is_no_longer_pending(mock_db):
    email = MockEmailAdapter()
    user_id = await _register_handler(mock_db, email).handle(COMMAND)
    await AuthWriteRepository(mock_db).update(user_id, {"status": "active"})
    handler = SendVerificationEmailHandler(
        AuthReadRepository(mock_db),
        AuthWriteRepository(mock_db),
        EmailVerificationTokenRepository(mock_db),
        email,
    )

    await handler.handle(SendVerificationEmailCommand(user_id=user_id))

    assert len(email.sent_email_verifications) == 1  # only the register mail


async def test_send_verification_email_swallows_delivery_failure(mock_db):
    user_id = await _register_handler(mock_db, MockEmailAdapter()).handle(COMMAND)
    handler = SendVerificationEmailHandler(
        AuthReadRepository(mock_db),
        AuthWriteRepository(mock_db),
        EmailVerificationTokenRepository(mock_db),
        FailingVerificationEmail(),
    )

    await handler.handle(SendVerificationEmailCommand(user_id=user_id))  # must not raise
