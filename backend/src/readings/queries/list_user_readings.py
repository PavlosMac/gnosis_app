import asyncio
from datetime import date

from pydantic import Field

from src.core.pagination import PaginatedResponse
from src.cqrs.queries import BaseQuery, QueryHandler
from src.readings.repository import ReadingReadRepository
from src.readings.schemas import ReadingListItem


class ListUserReadingsQuery(BaseQuery):
    user_id: str
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    spread_type: str | None = None
    birth_date: date | None = None
    tags: list[str] | None = None


class ListUserReadingsHandler(
    QueryHandler[ListUserReadingsQuery, PaginatedResponse[ReadingListItem]]
):
    def __init__(self, read_repo: ReadingReadRepository) -> None:
        self._read_repo = read_repo

    async def handle(self, query: ListUserReadingsQuery) -> PaginatedResponse[ReadingListItem]:
        skip = (query.page - 1) * query.page_size
        if query.tags:
            docs, total = await asyncio.gather(
                self._read_repo.find_by_user_id_ranked_by_tags(
                    query.user_id,
                    query.tags,
                    skip=skip,
                    limit=query.page_size,
                    spread_type=query.spread_type,
                    birth_date=query.birth_date,
                ),
                self._read_repo.count_by_user_id(
                    query.user_id,
                    spread_type=query.spread_type,
                    birth_date=query.birth_date,
                    tags=query.tags,
                ),
            )
        else:
            docs, total = await asyncio.gather(
                self._read_repo.find_by_user_id(
                    query.user_id,
                    skip=skip,
                    limit=query.page_size,
                    spread_type=query.spread_type,
                    birth_date=query.birth_date,
                ),
                self._read_repo.count_by_user_id(
                    query.user_id,
                    spread_type=query.spread_type,
                    birth_date=query.birth_date,
                ),
            )
        return PaginatedResponse[ReadingListItem](
            items=[ReadingListItem.model_validate(doc) for doc in docs],
            total=total,
            page=query.page,
            page_size=query.page_size,
        )
