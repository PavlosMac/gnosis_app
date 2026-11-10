from src.cards.repository import MajorArcanaMeaningReadRepository
from src.cards.schemas import MajorArcanaMeaningResponse
from src.core.exceptions import NotFoundError
from src.cqrs.queries import BaseQuery, QueryHandler


class GetMajorArcanaMeaningByNumberQuery(BaseQuery):
    number: int


class GetMajorArcanaMeaningByNumberHandler(
    QueryHandler[GetMajorArcanaMeaningByNumberQuery, MajorArcanaMeaningResponse]
):
    def __init__(self, meaning_read_repo: MajorArcanaMeaningReadRepository) -> None:
        self._meaning_read_repo = meaning_read_repo

    async def handle(self, query: GetMajorArcanaMeaningByNumberQuery) -> MajorArcanaMeaningResponse:
        doc = await self._meaning_read_repo.find_by_number(query.number)
        # Absent until the loader has run (fresh database, or a card the generator has
        # not reached yet): the client shows "not written yet", not an error page.
        if doc is None:
            raise NotFoundError("No meaning is written for this card yet")
        return MajorArcanaMeaningResponse.model_validate(doc)
