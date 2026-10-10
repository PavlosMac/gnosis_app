from src.auth.models import User
from src.auth.repository import AuthReadRepository, AuthWriteRepository
from src.users.queries.list_users import ListUsersHandler, ListUsersQuery


async def _insert_user(mock_db, email: str) -> None:
    """Listing only needs stored users — no need to drive registration (and its email
    and throttle dependencies) to get them."""
    user = User(email=email, password_hash="x")
    await AuthWriteRepository(mock_db).insert(user.to_document())


async def test_list_users_empty(mock_db):
    read_repo = AuthReadRepository(mock_db)
    handler = ListUsersHandler(read_repo)

    result = await handler.handle(ListUsersQuery())
    assert result.items == []
    assert result.total == 0
    assert result.page == 1
    assert result.page_size == 20


async def test_list_users_returns_all(mock_db):
    read_repo = AuthReadRepository(mock_db)
    await _insert_user(mock_db, "a@example.com")
    await _insert_user(mock_db, "b@example.com")

    handler = ListUsersHandler(read_repo)
    result = await handler.handle(ListUsersQuery())
    assert len(result.items) == 2
    assert result.total == 2


async def test_list_users_pagination(mock_db):
    read_repo = AuthReadRepository(mock_db)
    for i in range(3):
        await _insert_user(mock_db, f"user{i}@example.com")

    handler = ListUsersHandler(read_repo)

    page1 = await handler.handle(ListUsersQuery(page=1, page_size=2))
    assert len(page1.items) == 2
    assert page1.total == 3
    assert page1.page == 1

    page2 = await handler.handle(ListUsersQuery(page=2, page_size=2))
    assert len(page2.items) == 1
    assert page2.total == 3
    assert page2.page == 2
