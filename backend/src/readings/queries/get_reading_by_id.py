from src.cqrs.queries import BaseQuery, QueryHandler
from src.interpretations.repository import InterpretationReadRepository
from src.readings.repository import ReadingReadRepository
from src.readings.schemas import ReadingReadModel
from src.readings.service import ReadingNotFoundError


class GetReadingByIdQuery(BaseQuery):
    reading_id: str
    user_id: str


class GetReadingByIdHandler(QueryHandler[GetReadingByIdQuery, ReadingReadModel]):
    def __init__(
        self,
        read_repo: ReadingReadRepository,
        interpretation_read_repo: InterpretationReadRepository,
    ) -> None:
        self._read_repo = read_repo
        self._interpretation_read_repo = interpretation_read_repo

    async def handle(self, query: GetReadingByIdQuery) -> ReadingReadModel:
        doc = await self._read_repo.find_owned(query.reading_id, query.user_id)
        if doc is None:
            raise ReadingNotFoundError()
        doc["interpretations"] = await self._interpretation_read_repo.find_all_by_reading_id(
            query.reading_id
        )
        return ReadingReadModel.model_validate(doc)
