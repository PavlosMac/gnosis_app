import hashlib
from datetime import UTC, datetime

import pytest
from bson import ObjectId

from src.auth.commands.request_password_reset import (
    RequestPasswordResetCommand,
    RequestPasswordResetHandler,
)
from src.auth.repository import (
    AuthReadRepository,
    PasswordResetThrottleRepository,
    PasswordResetTokenRepository,
)
from src.auth.service import TooManyPasswordResetRequestsError
from src.core.config import settings
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
