from datetime import datetime

import pytest

from src.core.config import settings
from src.notifications.errors import EmailDeliveryError
from src.notifications.port import EmailPort

SUPPORT_INBOX = "support@example.com"


@pytest.fixture(autouse=True)
def support_inbox(monkeypatch):
    """The endpoint answers 503 without a destination inbox; every test here wants one
    unless it overrides this explicitly."""
    monkeypatch.setattr(settings, "support_email", SUPPORT_INBOX)
    return SUPPORT_INBOX


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
