from src.auth.repository import UserReadRepository
from src.auth.schemas import UserReadModel
from src.core.exceptions import NotFoundError
from src.cqrs.queries import BaseQuery, QueryHandler


class GetUserByIdQuery(BaseQuery):
    user_id: str


class GetUserByIdHandler(QueryHandler[GetUserByIdQuery, UserReadModel]):
    def __init__(self, read_repo: UserReadRepository) -> None:
        self._read_repo = read_repo

    async def handle(self, query: GetUserByIdQuery) -> UserReadModel:
        doc = await self._read_repo.find_by_id(query.user_id)
        if doc is None:
            raise NotFoundError("User not found")
        return UserReadModel.model_validate(doc)
