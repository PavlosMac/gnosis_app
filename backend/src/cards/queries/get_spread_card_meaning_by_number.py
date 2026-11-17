from src.cards.repository import SpreadCardMeaningReadRepository
from src.cards.schemas import SpreadCardMeaningResponse
from src.core.exceptions import NotFoundError
from src.cqrs.queries import BaseQuery, QueryHandler


class GetSpreadCardMeaningByNumberQuery(BaseQuery):
    number: int


class GetSpreadCardMeaningByNumberHandler(
    QueryHandler[GetSpreadCardMeaningByNumberQuery, SpreadCardMeaningResponse]
):
    def __init__(self, meaning_read_repo: SpreadCardMeaningReadRepository) -> None:
        self._meaning_read_repo = meaning_read_repo

    async def handle(self, query: GetSpreadCardMeaningByNumberQuery) -> SpreadCardMeaningResponse:
        doc = await self._meaning_read_repo.find_by_number(query.number)
        # Absent on a fresh database, or for a card the generator has not reached yet:
        # the client shows "not written yet", not an error page.
        if doc is None:
            raise NotFoundError("No meaning is written for this card yet")
        return SpreadCardMeaningResponse.model_validate(doc)
