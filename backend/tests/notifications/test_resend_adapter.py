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
