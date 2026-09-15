from datetime import UTC, datetime

import pytest
import resend.exceptions

from src.notifications.errors import EmailDeliveryError
from src.notifications.resend_adapter import ResendEmailAdapter

LINK = "https://tarotdivinations.com/reset-password?token=abc123"


@pytest.fixture
def adapter():
    return ResendEmailAdapter(
        api_key="re_test_key", from_address="Tarot Divinations <noreply@tarotdivinations.com>"
    )


async def test_send_builds_correct_payload(adapter, monkeypatch):
    captured: dict = {}

    async def fake_send_async(params):
        captured.update(params)
        return {"id": "email_123"}

    monkeypatch.setattr("resend.Emails.send_async", fake_send_async)
    await adapter.send_password_reset(to="user@example.com", reset_link=LINK)

    assert captured["from"] == "Tarot Divinations <noreply@tarotdivinations.com>"
    assert captured["to"] == "user@example.com"
    assert captured["subject"] == "Reset your Tarot Divinations password"
    assert LINK in captured["text"]
    assert LINK in captured["html"]


@pytest.mark.parametrize(
    "sdk_exc",
    [
        resend.exceptions.ResendError(
            code=429, error_type="rate_limit_exceeded", message="slow down", suggested_action=""
        ),
        resend.exceptions.NoContentError(),
        ConnectionError("network down"),
    ],
)
async def test_send_failures_map_to_email_delivery_error(adapter, monkeypatch, sdk_exc):
    async def fake_send_async(params):
        raise sdk_exc

    monkeypatch.setattr("resend.Emails.send_async", fake_send_async)
    with pytest.raises(EmailDeliveryError):
        await adapter.send_password_reset(to="user@example.com", reset_link=LINK)


async def test_close_is_a_noop(adapter):
    await adapter.close()


SUPPORT_KWARGS = dict(
    to="support@tarotdivinations.com",
    reply_to="asker@example.com",
    subject="Card missing",
    message="The Tower vanished from my spread.",
    user_id="64b7f0c2e4b0a1b2c3d4e5f6",
    submitted_at=datetime(2026, 9, 15, 10, 30, tzinfo=UTC),
)


async def test_send_support_request_builds_correct_payload(adapter, monkeypatch):
    captured: dict = {}

    async def fake_send_async(params):
        captured.update(params)
        return {"id": "email_456"}

    monkeypatch.setattr("resend.Emails.send_async", fake_send_async)
    await adapter.send_support_request(**SUPPORT_KWARGS)

    assert captured["from"] == "Tarot Divinations <noreply@tarotdivinations.com>"
    assert captured["to"] == "support@tarotdivinations.com"
    assert captured["reply_to"] == "asker@example.com"
    assert captured["subject"] == "[Support] Card missing"
    assert "The Tower vanished from my spread." in captured["text"]
    assert "The Tower vanished from my spread." in captured["html"]
    assert "64b7f0c2e4b0a1b2c3d4e5f6" in captured["text"]


async def test_send_support_request_failure_maps_to_email_delivery_error(adapter, monkeypatch):
    async def fake_send_async(params):
        raise ConnectionError("network down")

    monkeypatch.setattr("resend.Emails.send_async", fake_send_async)
    with pytest.raises(EmailDeliveryError):
        await adapter.send_support_request(**SUPPORT_KWARGS)
