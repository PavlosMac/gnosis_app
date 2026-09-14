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
