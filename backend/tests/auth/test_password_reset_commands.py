import hashlib
from datetime import UTC, datetime, timedelta

import pytest
from bson import ObjectId

from src.auth.commands.confirm_password_reset import (
    ConfirmPasswordResetCommand,
    ConfirmPasswordResetHandler,
)
from src.auth.commands.request_password_reset import (
    RequestPasswordResetCommand,
    RequestPasswordResetHandler,
)
from src.auth.repository import (
    AuthReadRepository,
    AuthWriteRepository,
    PasswordResetThrottleRepository,
    PasswordResetTokenRepository,
    RefreshTokenRepository,
)
from src.auth.service import (
    ExpiredPasswordResetTokenError,
    InvalidPasswordResetTokenError,
    TooManyPasswordResetRequestsError,
)
from src.core.config import settings
from src.core.security import verify_password
from src.notifications.errors import EmailDeliveryError
from src.notifications.mock_adapter import MockEmailAdapter
from src.notifications.port import EmailPort


@pytest.fixture
async def known_user(mock_db):
    oid = ObjectId()
    await mock_db["users"].insert_one(
        {
            "_id": oid,
            "email": "known@example.com",
            "password_hash": "x",
            "created_at": datetime.now(UTC),
        }
    )
    return str(oid)


@pytest.fixture
def mock_email_adapter():
    return MockEmailAdapter()


@pytest.fixture
def request_handler(mock_db, mock_email_adapter):
    return RequestPasswordResetHandler(
        read_repo=AuthReadRepository(mock_db),
        reset_token_repo=PasswordResetTokenRepository(mock_db),
        throttle_repo=PasswordResetThrottleRepository(mock_db),
        email=mock_email_adapter,
    )


async def test_request_unknown_email_is_silent_noop(request_handler, mock_email_adapter, mock_db):
    await request_handler.handle(RequestPasswordResetCommand(email="ghost@example.com"))
    assert mock_email_adapter.sent_password_resets == []
    assert await mock_db["password_reset_tokens"].count_documents({}) == 0


async def test_request_known_email_stores_hash_and_sends_link(
    request_handler, mock_email_adapter, mock_db, known_user
):
    await request_handler.handle(RequestPasswordResetCommand(email="known@example.com"))

    [sent] = mock_email_adapter.sent_password_resets
    assert sent["to"] == "known@example.com"
    assert sent["reset_link"].startswith(f"{settings.frontend_base_url}/reset-password?token=")

    doc = await mock_db["password_reset_tokens"].find_one({"user_id": known_user})
    assert doc is not None
    raw_token = sent["reset_link"].split("token=", 1)[1]
    # the stored value is the sha256 of the raw token — catches a raw/hash swap
    assert doc["token_hash"] == hashlib.sha256(raw_token.encode()).hexdigest()
    assert doc["token_hash"] != raw_token  # never store the raw value


async def test_second_request_invalidates_first_token(
    request_handler, mock_email_adapter, mock_db, known_user
):
    await request_handler.handle(RequestPasswordResetCommand(email="known@example.com"))
    await request_handler.handle(RequestPasswordResetCommand(email="known@example.com"))

    first_link = mock_email_adapter.sent_password_resets[0]["reset_link"]
    first_hash = hashlib.sha256(first_link.split("token=", 1)[1].encode()).hexdigest()
    repo = PasswordResetTokenRepository(mock_db)
    assert await repo.consume(first_hash) is None  # gone
    assert await mock_db["password_reset_tokens"].count_documents({}) == 1


async def test_request_rate_limited_after_max_attempts(request_handler):
    for _ in range(settings.password_reset_rate_limit_max_attempts):
        await request_handler.handle(RequestPasswordResetCommand(email="ghost@example.com"))
    with pytest.raises(TooManyPasswordResetRequestsError):
        await request_handler.handle(RequestPasswordResetCommand(email="ghost@example.com"))


async def test_email_delivery_failure_is_swallowed(mock_db, known_user):
    class FailingEmailAdapter(EmailPort):
        async def send_password_reset(self, to: str, reset_link: str) -> None:
            raise EmailDeliveryError()

        async def send_support_request(
            self,
            to: str,
            reply_to: str,
            subject: str,
            message: str,
            user_id: str,
            submitted_at: datetime,
        ) -> None:
            raise EmailDeliveryError()

        async def close(self) -> None:
            return None

    handler = RequestPasswordResetHandler(
        read_repo=AuthReadRepository(mock_db),
        reset_token_repo=PasswordResetTokenRepository(mock_db),
        throttle_repo=PasswordResetThrottleRepository(mock_db),
        email=FailingEmailAdapter(),
    )
    # must not raise — enumeration safety: a provider outage only errors for
    # existing accounts, so the endpoint answers 200 either way
    await handler.handle(RequestPasswordResetCommand(email="known@example.com"))
    assert await mock_db["password_reset_tokens"].count_documents({"user_id": known_user}) == 1


@pytest.fixture
def confirm_handler(mock_db):
    return ConfirmPasswordResetHandler(
        write_repo=AuthWriteRepository(mock_db),
        reset_token_repo=PasswordResetTokenRepository(mock_db),
        refresh_token_repo=RefreshTokenRepository(mock_db),
    )


async def _issue_token(request_handler, mock_email_adapter) -> str:
    """Run the request flow and return the raw token from the captured link."""
    await request_handler.handle(RequestPasswordResetCommand(email="known@example.com"))
    link = mock_email_adapter.sent_password_resets[-1]["reset_link"]
    return link.split("token=", 1)[1]


async def test_confirm_updates_password_and_revokes_sessions(
    request_handler, confirm_handler, mock_email_adapter, mock_db, known_user
):
    refresh_repo = RefreshTokenRepository(mock_db)
    await refresh_repo.store("jti1", "fam1", known_user, datetime.now(UTC) + timedelta(days=1))
    raw_token = await _issue_token(request_handler, mock_email_adapter)

    await confirm_handler.handle(
        ConfirmPasswordResetCommand(token=raw_token, new_password="new-password-123")
    )

    user = await mock_db["users"].find_one({"_id": ObjectId(known_user)})
    assert verify_password("new-password-123", user["password_hash"])
    assert await refresh_repo.consume("jti1") is None  # all sessions revoked


async def test_confirm_garbage_token_raises_invalid(confirm_handler):
    with pytest.raises(InvalidPasswordResetTokenError):
        await confirm_handler.handle(
            ConfirmPasswordResetCommand(token="garbage", new_password="new-password-123")
        )


async def test_confirm_same_token_twice_raises_invalid(
    request_handler, confirm_handler, mock_email_adapter, known_user
):
    raw_token = await _issue_token(request_handler, mock_email_adapter)
    await confirm_handler.handle(
        ConfirmPasswordResetCommand(token=raw_token, new_password="new-password-123")
    )
    with pytest.raises(InvalidPasswordResetTokenError):
        await confirm_handler.handle(
            ConfirmPasswordResetCommand(token=raw_token, new_password="other-password-123")
        )


async def test_confirm_expired_token_raises_expired(
    request_handler, confirm_handler, mock_email_adapter, mock_db, known_user
):
    raw_token = await _issue_token(request_handler, mock_email_adapter)
    await mock_db["password_reset_tokens"].update_many(
        {}, {"$set": {"expires_at": datetime.now(UTC) - timedelta(minutes=1)}}
    )
    with pytest.raises(ExpiredPasswordResetTokenError):
        await confirm_handler.handle(
            ConfirmPasswordResetCommand(token=raw_token, new_password="new-password-123")
        )
