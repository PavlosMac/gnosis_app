import asyncio
from datetime import date

from pydantic import Field

from src.core.pagination import MAX_PAGE
from src.cqrs.queries import BaseQuery, QueryHandler
from src.readings.repository import ReadingReadRepository, UserTagsReadRepository
from src.readings.schemas import (
    MAX_SPREAD_TYPE_LENGTH,
    ReadingListItem,
    ReadingListResponse,
    ReadingSortField,
    SortOrder,
    TagSummary,
)


def _sort_spec(field: ReadingSortField, order: SortOrder) -> list[tuple[str, int]]:
    """Mongo sort for an explicit field and direction. `field` is currently always
    `created_at` (the only whitelisted value) — a tiebreak for a second sort field can
    be added here if one is ever introduced."""
    return [(field, 1 if order == "asc" else -1)]


class ListUserReadingsQuery(BaseQuery):
    user_id: str
    page: int = Field(default=1, ge=1, le=MAX_PAGE)
    page_size: int = Field(default=20, ge=1, le=100)
    spread_type: str | None = Field(default=None, max_length=MAX_SPREAD_TYPE_LENGTH)
    birth_date: date | None = None
    tags: list[str] | None = None
    sort: ReadingSortField | None = None
    order: SortOrder = "desc"


class ListUserReadingsHandler(QueryHandler[ListUserReadingsQuery, ReadingListResponse]):
    def __init__(
        self,
        read_repo: ReadingReadRepository,
        user_tags_read_repo: UserTagsReadRepository,
    ) -> None:
        self._read_repo = read_repo
        self._user_tags_read_repo = user_tags_read_repo

    async def handle(self, query: ListUserReadingsQuery) -> ReadingListResponse:
        skip = (query.page - 1) * query.page_size
        # Truthy tags means "filter by tag" throughout — an empty list behaves like no
        # filter, so this one check picks both the docs query and the count filter.
        tags = query.tags if query.tags else None
        # `order` is a direction for `sort` and means nothing on its own: without a
        # sort the repository's newest-first default stands.
        docs_coro = self._read_repo.find_by_user_id(
            query.user_id,
            skip=skip,
            limit=query.page_size,
            spread_type=query.spread_type,
            birth_date=query.birth_date,
            tags=tags,
            sort=_sort_spec(query.sort, query.order) if query.sort else None,
        )
        docs, total, user_tags_doc = await asyncio.gather(
            docs_coro,
            self._read_repo.count_by_user_id(
                query.user_id,
                spread_type=query.spread_type,
                birth_date=query.birth_date,
                tags=tags,
            ),
            self._user_tags_read_repo.find_by_user_id(query.user_id),
        )
        return ReadingListResponse(
            items=[ReadingListItem.model_validate(doc) for doc in docs],
            total=total,
            page=query.page,
            page_size=query.page_size,
            user_tags=[
                TagSummary.model_validate(tag) for tag in (user_tags_doc or {}).get("tags", [])
            ],
        )
