import asyncio

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
        # Independent lookups — the interpretation lookup only needs query.reading_id,
        # not any field of the reading — run concurrently rather than as two sequential
        # round trips.
        doc, interpretation = await asyncio.gather(
            self._read_repo.find_owned(query.reading_id, query.user_id),
            self._interpretation_read_repo.find_by_reading_id(query.reading_id),
        )
        if doc is None:
            raise ReadingNotFoundError()
        doc["interpretation"] = interpretation
        return ReadingReadModel.model_validate(doc)
