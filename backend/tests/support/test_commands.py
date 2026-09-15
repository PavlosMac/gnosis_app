from datetime import datetime

import pytest

from src.auth.repository import PasswordResetThrottleRepository
from src.core.config import settings
from src.notifications.errors import EmailDeliveryError
from src.notifications.mock_adapter import MockEmailAdapter
from src.support.commands.contact_support import ContactSupportCommand, ContactSupportHandler
from src.support.service import SupportNotConfiguredError, TooManySupportRequestsError
from tests.support.conftest import SUPPORT_INBOX, FailingEmailAdapter

USER_ID = "64b7f0c2e4b0a1b2c3d4e5f6"
USER_EMAIL = "asker@example.com"


def _command(user_id: str = USER_ID) -> ContactSupportCommand:
    return ContactSupportCommand(
        user_id=user_id,
        user_email=USER_EMAIL,
        subject="Card missing",
        message="The Tower vanished from my spread.",
    )


@pytest.fixture
def mock_email_adapter():
    return MockEmailAdapter()


@pytest.fixture
def handler(mock_db, mock_email_adapter):
    return ContactSupportHandler(
        throttle_repo=PasswordResetThrottleRepository(mock_db), email=mock_email_adapter
    )


async def test_relays_message_to_support_inbox_with_reply_to_user(handler, mock_email_adapter):
    await handler.handle(_command())

    assert len(mock_email_adapter.sent_support_requests) == 1
    sent = mock_email_adapter.sent_support_requests[0]
    assert sent["to"] == SUPPORT_INBOX
    assert sent["reply_to"] == USER_EMAIL
    assert sent["subject"] == "Card missing"
    assert sent["message"] == "The Tower vanished from my spread."
    assert sent["user_id"] == USER_ID
    assert sent["submitted_at"].tzinfo is not None


async def test_rate_limited_after_max_attempts(handler, mock_email_adapter):
    for _ in range(settings.support_contact_rate_limit_max_attempts):
        await handler.handle(_command())

    with pytest.raises(TooManySupportRequestsError):
        await handler.handle(_command())
    assert (
        len(mock_email_adapter.sent_support_requests)
        == settings.support_contact_rate_limit_max_attempts
    )


async def test_rate_limit_is_per_user(handler, mock_email_adapter):
    for _ in range(settings.support_contact_rate_limit_max_attempts):
        await handler.handle(_command())

    await handler.handle(_command(user_id="000000000000000000000001"))
    assert len(mock_email_adapter.sent_support_requests) == (
        settings.support_contact_rate_limit_max_attempts + 1
    )


async def test_throttle_key_does_not_collide_with_password_reset(handler, mock_db):
    # Password-reset attempts for the same string must not count against support.
    throttle = PasswordResetThrottleRepository(mock_db)
    for _ in range(settings.support_contact_rate_limit_max_attempts):
        await throttle.record_attempt(USER_ID, expires_at=datetime.now().astimezone())

    await handler.handle(_command())  # no raise


async def test_email_failure_propagates(mock_db):
    handler = ContactSupportHandler(
        throttle_repo=PasswordResetThrottleRepository(mock_db), email=FailingEmailAdapter()
    )
    with pytest.raises(EmailDeliveryError):
        await handler.handle(_command())


async def test_unconfigured_inbox_raises_and_sends_nothing(
    handler, mock_email_adapter, monkeypatch
):
    monkeypatch.setattr(settings, "support_email", "")
    with pytest.raises(SupportNotConfiguredError):
        await handler.handle(_command())
    assert mock_email_adapter.sent_support_requests == []
