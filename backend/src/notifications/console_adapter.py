from datetime import datetime

import structlog

from src.notifications.port import EmailPort

logger = structlog.stdlib.get_logger(__name__)


class ConsoleEmailAdapter(EmailPort):
    """Dev fallback when RESEND_API_KEY is unset — logs the link instead of sending."""

    async def send_password_reset(self, to: str, reset_link: str) -> None:
        logger.info("password reset email (console)", to=to, reset_link=reset_link)

    async def send_support_request(
        self,
        to: str,
        reply_to: str,
        subject: str,
        message: str,
        user_id: str,
        submitted_at: datetime,
    ) -> None:
        logger.info(
            "support request email (console)",
            to=to,
            reply_to=reply_to,
            subject=subject,
            user_id=user_id,
            submitted_at=submitted_at.isoformat(),
            message=message,
        )

    async def close(self) -> None:
        return None
