from src.cqrs.queries import BaseQuery, QueryHandler
from src.interpretations.repository import InterpretationReadRepository
from src.interpretations.schemas import InterpretationReadModel


class GetInterpretationsByReadingIdQuery(BaseQuery):
    """Fetches every saved lens slot for a reading. Callers are responsible for their own
    authorization — this query does not check reading ownership; it is meant to follow a
    command (e.g. SaveInterpretationCommand) that already validated it."""

    reading_id: str


class GetInterpretationsByReadingIdHandler(
    QueryHandler[GetInterpretationsByReadingIdQuery, list[InterpretationReadModel]]
):
    def __init__(self, read_repo: InterpretationReadRepository) -> None:
        self._read_repo = read_repo

    async def handle(
        self, query: GetInterpretationsByReadingIdQuery
    ) -> list[InterpretationReadModel]:
        docs = await self._read_repo.find_all_by_reading_id(query.reading_id)
        return [InterpretationReadModel.model_validate(doc) for doc in docs]
