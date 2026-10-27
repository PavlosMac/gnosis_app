import structlog

from src.auth.commands.delete_user import DeleteUserCommand, DeleteUserHandler
from src.auth.repository import AuthReadRepository
from src.core.exceptions import ConflictError, NotFoundError
from src.cqrs.commands import BaseCommand, CommandHandler

logger = structlog.stdlib.get_logger(__name__)


class AdminDeleteUserCommand(BaseCommand):
    user_id: str
    admin_id: str


class AdminDeleteUserHandler(CommandHandler[AdminDeleteUserCommand, None]):
    """Superadmin deletion. Owns only the admin-side checks; the erasure itself is
    DeleteUserHandler, the one cascade both this and DELETE /auth/me run."""

    def __init__(self, read_repo: AuthReadRepository, delete_handler: DeleteUserHandler) -> None:
        self._read_repo = read_repo
        self._delete_handler = delete_handler

    async def handle(self, command: AdminDeleteUserCommand) -> None:
        if command.user_id == command.admin_id:
            # The self-service path re-verifies the password; this one does not, so
            # it must not become a shortcut past that check.
            raise ConflictError("Use your own account page to delete your account")
        if await self._read_repo.find_by_id(command.user_id, projection={"_id": 1}) is None:
            raise NotFoundError("User not found")
        await self._delete_handler.handle(DeleteUserCommand(user_id=command.user_id))
        logger.info("account deleted by admin", user_id=command.user_id, admin_id=command.admin_id)
