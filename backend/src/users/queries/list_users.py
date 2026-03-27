from pydantic import Field

from src.auth.repository import UserReadRepository
from src.auth.schemas import UserReadModel
from src.core.pagination import PaginatedResponse
from src.cqrs.queries import BaseQuery, QueryHandler


class ListUsersQuery(BaseQuery):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class ListUsersHandler(QueryHandler[ListUsersQuery, PaginatedResponse[UserReadModel]]):
    def __init__(self, read_repo: UserReadRepository) -> None:
        self._read_repo = read_repo

    async def handle(self, query: ListUsersQuery) -> PaginatedResponse[UserReadModel]:
        skip = (query.page - 1) * query.page_size
        docs = await self._read_repo.find_many(
            {}, skip=skip, limit=query.page_size, sort=[("created_at", -1)]
        )
        total = await self._read_repo.count({})
        return PaginatedResponse[UserReadModel](
            items=[UserReadModel.model_validate(doc) for doc in docs],
            total=total,
            page=query.page,
            page_size=query.page_size,
        )
