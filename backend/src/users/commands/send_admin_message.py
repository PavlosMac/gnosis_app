import structlog

from src.auth.repository import AuthReadRepository
from src.core.exceptions import NotFoundError
from src.cqrs.commands import BaseCommand, CommandHandler
from src.notifications.port import EmailPort

logger = structlog.stdlib.get_logger(__name__)


class SendAdminMessageCommand(BaseCommand):
    user_id: str
    admin_id: str
    subject: str
    message: str


class SendAdminMessageHandler(CommandHandler[SendAdminMessageCommand, None]):
    """One-way note from the superadmin to one user. Delivery failure propagates as
    502: the admin is watching and simply sends again."""

    def __init__(self, read_repo: AuthReadRepository, email: EmailPort) -> None:
        self._read_repo = read_repo
        self._email = email

    async def handle(self, command: SendAdminMessageCommand) -> None:
        doc = await self._read_repo.find_by_id(command.user_id, projection={"email": 1})
        if doc is None:
            raise NotFoundError("User not found")
        await self._email.send_admin_message(
            to=doc["email"], subject=command.subject, message=command.message
        )
        # Neither subject nor body: both are personal data.
        logger.info("admin message sent", user_id=command.user_id, admin_id=command.admin_id)
