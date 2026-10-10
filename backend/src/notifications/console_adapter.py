from datetime import datetime

import structlog

from src.notifications.port import EmailPort

logger = structlog.stdlib.get_logger(__name__)

_REDACTED = "[redacted]"


class ConsoleEmailAdapter(EmailPort):
    """Fallback when RESEND_API_KEY is unset — logs instead of sending.

    Never logs recipients or message bodies. The link (which carries a live one-time
    token) is logged only when `reveal_links` is set, which main.py does for
    APP_ENV=development alone: a production deploy that is merely missing its Resend
    key runs this adapter too, and must not write usable tokens to its logs."""

    def __init__(self, reveal_links: bool = False) -> None:
        self._reveal_links = reveal_links

    def _link(self, link: str) -> str:
        return link if self._reveal_links else _REDACTED

    async def send_password_reset(self, to: str, reset_link: str) -> None:
        logger.info("password reset email (console)", reset_link=self._link(reset_link))

    async def send_email_verification(self, to: str, verify_link: str) -> None:
        logger.info("email verification email (console)", verify_link=self._link(verify_link))

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
            user_id=user_id,
            submitted_at=submitted_at.isoformat(),
        )

    async def close(self) -> None:
        return None
