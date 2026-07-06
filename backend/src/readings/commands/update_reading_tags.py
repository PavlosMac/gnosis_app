from bson import ObjectId
from bson.errors import InvalidId

from src.cqrs.commands import BaseCommand, CommandHandler
from src.readings.repository import ReadingReadRepository, ReadingWriteRepository
from src.readings.schemas import ReadingReadModel
from src.readings.service import ReadingNotFoundError


class UpdateReadingTagsCommand(BaseCommand):
    reading_id: str
    user_id: str
    tags: list[str]


class UpdateReadingTagsHandler(CommandHandler[UpdateReadingTagsCommand, ReadingReadModel]):
    def __init__(
        self,
        read_repo: ReadingReadRepository,
        write_repo: ReadingWriteRepository,
    ) -> None:
        self._read_repo = read_repo
        self._write_repo = write_repo

    async def handle(self, command: UpdateReadingTagsCommand) -> ReadingReadModel:
        try:
            oid = ObjectId(command.reading_id)
        except InvalidId:
            raise ReadingNotFoundError()
        doc = await self._read_repo.find_one({"_id": oid, "user_id": ObjectId(command.user_id)})
        if doc is None:
            raise ReadingNotFoundError()
        await self._write_repo.update(command.reading_id, {"tags": command.tags})
        doc["tags"] = command.tags
        return ReadingReadModel.model_validate(doc)
