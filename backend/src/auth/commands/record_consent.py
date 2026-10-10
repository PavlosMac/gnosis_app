from datetime import UTC, datetime

from src.auth.repository import AuthWriteRepository
from src.cqrs.commands import BaseCommand, CommandHandler


class RecordConsentCommand(BaseCommand):
    user_id: str
    terms: str | None = None
    privacy: str | None = None


class RecordConsentHandler(CommandHandler[RecordConsentCommand, None]):
    def __init__(self, write_repo: AuthWriteRepository) -> None:
        self._write_repo = write_repo

    async def handle(self, command: RecordConsentCommand) -> None:
        now = datetime.now(UTC)
        for document, version in (("terms", command.terms), ("privacy", command.privacy)):
            if version is not None:
                await self._write_repo.record_consent(command.user_id, document, version, now)
