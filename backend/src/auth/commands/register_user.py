from src.auth.models import User
from src.auth.repository import UserReadRepository, UserWriteRepository
from src.auth.service import EmailAlreadyExistsError
from src.core.security import hash_password
from src.cqrs.commands import BaseCommand, CommandHandler


class RegisterUserCommand(BaseCommand):
    email: str
    password: str
    display_name: str | None = None


class RegisterUserHandler(CommandHandler[RegisterUserCommand, str]):
    def __init__(
        self,
        write_repo: UserWriteRepository,
        read_repo: UserReadRepository,
    ) -> None:
        self._write_repo = write_repo
        self._read_repo = read_repo

    async def handle(self, command: RegisterUserCommand) -> str:
        existing = await self._read_repo.find_by_email(command.email)
        if existing:
            raise EmailAlreadyExistsError()

        user = User(
            email=command.email,
            password_hash=hash_password(command.password),
            display_name=command.display_name,
        )
        user_id = await self._write_repo.insert(user.to_document())
        return user_id
