from datetime import datetime
from typing import Any

from src.notifications.port import EmailPort


class MockEmailAdapter(EmailPort):
    def __init__(self) -> None:
        self.sent_password_resets: list[dict[str, str]] = []
        self.sent_support_requests: list[dict[str, Any]] = []

    async def send_password_reset(self, to: str, reset_link: str) -> None:
        self.sent_password_resets.append({"to": to, "reset_link": reset_link})

    async def send_support_request(
        self,
        to: str,
        reply_to: str,
        subject: str,
        message: str,
        user_id: str,
        submitted_at: datetime,
    ) -> None:
        self.sent_support_requests.append(
            {
                "to": to,
                "reply_to": reply_to,
                "subject": subject,
                "message": message,
                "user_id": user_id,
                "submitted_at": submitted_at,
            }
        )

    async def close(self) -> None:
        return None
