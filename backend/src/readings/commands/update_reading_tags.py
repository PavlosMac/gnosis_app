from bson import ObjectId
from bson.errors import InvalidId

from src.cqrs.commands import BaseCommand, CommandHandler
from src.readings.repository import (
    ReadingReadRepository,
    ReadingWriteRepository,
    UserTagsWriteRepository,
)
from src.readings.schemas import ReadingReadModel
from src.readings.service import ReadingNotFoundError


class UpdateReadingTagsCommand(BaseCommand):
    reading_id: str
    user_id: str
    tags: list[str]


class UpdateReadingTagsHandler(CommandHandler[UpdateReadingTagsCommand, ReadingReadModel]):
    def __init__(
        self,
        write_repo: ReadingWriteRepository,
        read_repo: ReadingReadRepository,
        user_tags_write_repo: UserTagsWriteRepository,
    ) -> None:
        self._write_repo = write_repo
        self._read_repo = read_repo
        self._user_tags_write_repo = user_tags_write_repo

    async def handle(self, command: UpdateReadingTagsCommand) -> ReadingReadModel:
        try:
            oid = ObjectId(command.reading_id)
        except InvalidId:
            raise ReadingNotFoundError()
        doc = await self._read_repo.find_one({"_id": oid, "user_id": ObjectId(command.user_id)})
        if doc is None:
            raise ReadingNotFoundError()
        await self._write_repo.update(command.reading_id, {"tags": command.tags})
        # Tag edits are rare and listing is frequent, so the per-user vocabulary is
        # rebuilt here rather than aggregated on every list request. Two concurrent
        # edits by the same user both rebuild and the last write wins — worst case a
        # briefly stale vocabulary, healed by the next edit.
        tag_docs = await self._read_repo.count_tags_by_user_id(command.user_id)
        await self._user_tags_write_repo.replace_for_user(command.user_id, tag_docs)
        doc["tags"] = command.tags
        return ReadingReadModel.model_validate(doc)
