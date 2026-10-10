from datetime import UTC, datetime

from structlog.testing import capture_logs

from src.core.exceptions import AppError
from src.notifications.console_adapter import ConsoleEmailAdapter
from src.notifications.errors import EmailDeliveryError
from src.notifications.mock_adapter import MockEmailAdapter
from src.notifications.port import EmailPort


def test_email_delivery_error_is_502_app_error():
    err = EmailDeliveryError()
    assert isinstance(err, AppError)
    assert err.status_code == 502
    assert err.detail == "Email delivery failed"


async def test_mock_adapter_records_sends():
    adapter = MockEmailAdapter()
    await adapter.send_password_reset(to="a@b.com", reset_link="http://x/reset?token=t1")
    await adapter.send_password_reset(to="c@d.com", reset_link="http://x/reset?token=t2")
    assert adapter.sent_password_resets == [
        {"to": "a@b.com", "reset_link": "http://x/reset?token=t1"},
        {"to": "c@d.com", "reset_link": "http://x/reset?token=t2"},
    ]
    await adapter.close()


async def test_console_adapter_sends_without_error():
    adapter = ConsoleEmailAdapter()
    await adapter.send_password_reset(to="a@b.com", reset_link="http://x/reset?token=t1")
    await adapter.close()


def test_adapters_implement_port():
    assert issubclass(MockEmailAdapter, EmailPort)
    assert issubclass(ConsoleEmailAdapter, EmailPort)


SUPPORT_KWARGS = dict(
    to="support@example.com",
    reply_to="asker@example.com",
    subject="Card missing",
    message="The Tower vanished from my spread.",
    user_id="64b7f0c2e4b0a1b2c3d4e5f6",
    submitted_at=datetime(2026, 9, 15, 10, 30, tzinfo=UTC),
)


async def test_mock_adapter_records_support_requests():
    adapter = MockEmailAdapter()
    await adapter.send_support_request(**SUPPORT_KWARGS)
    assert adapter.sent_support_requests == [SUPPORT_KWARGS]


async def test_console_adapter_sends_support_request_without_error():
    adapter = ConsoleEmailAdapter()
    await adapter.send_support_request(**SUPPORT_KWARGS)
    await adapter.close()


VERIFY_LINK = "http://x/verify-email?token=secret-token"


async def test_mock_adapter_records_email_verifications():
    adapter = MockEmailAdapter()
    await adapter.send_email_verification(to="a@b.com", verify_link=VERIFY_LINK)
    assert adapter.sent_email_verifications == [{"to": "a@b.com", "verify_link": VERIFY_LINK}]


async def test_console_adapter_redacts_links_and_recipients_by_default():
    """A production deploy that is merely missing RESEND_API_KEY runs this adapter —
    live one-time tokens and addresses must not reach its logs."""
    adapter = ConsoleEmailAdapter()

    with capture_logs() as logs:
        await adapter.send_password_reset(
            to="a@b.com", reset_link="http://x/reset?token=secret-token"
        )
        await adapter.send_email_verification(to="a@b.com", verify_link=VERIFY_LINK)
        await adapter.send_support_request(**SUPPORT_KWARGS)

    logged = str(logs)
    assert len(logs) == 3
    assert "secret-token" not in logged
    assert "a@b.com" not in logged
    assert "asker@example.com" not in logged
    assert "The Tower vanished" not in logged


async def test_console_adapter_reveals_links_only_when_asked():
    adapter = ConsoleEmailAdapter(reveal_links=True)

    with capture_logs() as logs:
        await adapter.send_email_verification(to="a@b.com", verify_link=VERIFY_LINK)

    logged = str(logs)
    assert "secret-token" in logged
    assert "a@b.com" not in logged
