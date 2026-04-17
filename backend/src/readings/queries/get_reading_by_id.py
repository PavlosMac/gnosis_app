from bson import ObjectId
from bson.errors import InvalidId

from src.cqrs.queries import BaseQuery, QueryHandler
from src.readings.repository import ReadingReadRepository
from src.readings.schemas import ReadingReadModel
from src.readings.service import ReadingNotFoundError


class GetReadingByIdQuery(BaseQuery):
    reading_id: str
    user_id: str


class GetReadingByIdHandler(QueryHandler[GetReadingByIdQuery, ReadingReadModel]):
    def __init__(self, read_repo: ReadingReadRepository) -> None:
        self._read_repo = read_repo

    async def handle(self, query: GetReadingByIdQuery) -> ReadingReadModel:
        try:
            oid = ObjectId(query.reading_id)
        except InvalidId:
            raise ReadingNotFoundError()
        doc = await self._read_repo.find_one({"_id": oid, "user_id": ObjectId(query.user_id)})
        if doc is None:
            raise ReadingNotFoundError()
        return ReadingReadModel.model_validate(doc)
