from src.auth.repository import AuthReadRepository
from src.auth.schemas import UserReadModel
from src.cqrs.queries import BaseQuery, QueryHandler


class GetUserByEmailQuery(BaseQuery):
    email: str


class GetUserByEmailHandler(QueryHandler[GetUserByEmailQuery, UserReadModel | None]):
    def __init__(self, read_repo: AuthReadRepository) -> None:
        self._read_repo = read_repo

    async def handle(self, query: GetUserByEmailQuery) -> UserReadModel | None:
        doc = await self._read_repo.find_by_email(query.email)
        if doc is None:
            return None
        return UserReadModel.model_validate(doc)
