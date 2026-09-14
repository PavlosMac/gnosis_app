import structlog

from src.notifications.port import EmailPort

logger = structlog.stdlib.get_logger(__name__)


class ConsoleEmailAdapter(EmailPort):
    """Dev fallback when RESEND_API_KEY is unset — logs the link instead of sending."""

    async def send_password_reset(self, to: str, reset_link: str) -> None:
        logger.info("password reset email (console)", to=to, reset_link=reset_link)

    async def close(self) -> None:
        return None
