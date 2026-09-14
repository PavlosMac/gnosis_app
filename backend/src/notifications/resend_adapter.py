import resend
import structlog

from src.notifications.errors import EmailDeliveryError
from src.notifications.port import EmailPort
from src.notifications.templates import (
    password_reset_html,
    password_reset_subject,
    password_reset_text,
)

logger = structlog.stdlib.get_logger(__name__)


class ResendEmailAdapter(EmailPort):
    def __init__(self, api_key: str, from_address: str) -> None:
        # The SDK authenticates via a module-level global; set once at construction.
        resend.api_key = api_key
        self._from = from_address

    async def send_password_reset(self, to: str, reset_link: str) -> None:
        params: resend.Emails.SendParams = {
            "from": self._from,
            "to": to,
            "subject": password_reset_subject(),
            "text": password_reset_text(reset_link),
            "html": password_reset_html(reset_link),
        }
        try:
            response = await resend.Emails.send_async(params)
        except Exception as exc:
            # Broad on purpose: the port contract is "succeeds or raises
            # EmailDeliveryError". The SDK raises a ResendError tree but also
            # NoContentError (bare Exception) and transport-level errors.
            logger.warning(
                "resend send failed", error=type(exc).__name__, detail=str(exc), to=to
            )
            raise EmailDeliveryError() from exc
        logger.info("password reset email sent", to=to, message_id=response["id"])

    async def close(self) -> None:
        return None
