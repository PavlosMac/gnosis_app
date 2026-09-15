from datetime import datetime

import resend
import structlog

from src.notifications.errors import EmailDeliveryError
from src.notifications.port import EmailPort
from src.notifications.templates import (
    password_reset_html,
    password_reset_subject,
    password_reset_text,
    support_request_html,
    support_request_subject,
    support_request_text,
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
        message_id = await self._send(params, to=to)
        logger.info("password reset email sent", to=to, message_id=message_id)

    async def send_support_request(
        self,
        to: str,
        reply_to: str,
        subject: str,
        message: str,
        user_id: str,
        submitted_at: datetime,
    ) -> None:
        # From stays EMAIL_FROM so DKIM/DMARC alignment holds; Reply-To carries the
        # user's address so a plain inbox reply reaches them.
        params: resend.Emails.SendParams = {
            "from": self._from,
            "to": to,
            "reply_to": reply_to,
            "subject": support_request_subject(subject),
            "text": support_request_text(message, reply_to, user_id, submitted_at),
            "html": support_request_html(message, reply_to, user_id, submitted_at),
        }
        message_id = await self._send(params, to=to)
        logger.info("support request email sent", to=to, user_id=user_id, message_id=message_id)

    async def _send(self, params: resend.Emails.SendParams, to: str) -> str:
        try:
            response = await resend.Emails.send_async(params)
            return response["id"]
        except Exception as exc:
            # Broad on purpose: the port contract is "succeeds or raises
            # EmailDeliveryError". The SDK raises a ResendError tree but also
            # NoContentError (bare Exception), transport-level errors, and a
            # malformed/missing "id" in the response (KeyError) — all map to the
            # same failure so callers never see anything but the port contract.
            logger.warning("resend send failed", error=type(exc).__name__, detail=str(exc), to=to)
            raise EmailDeliveryError() from exc

    async def close(self) -> None:
        return None
