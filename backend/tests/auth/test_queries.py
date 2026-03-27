from src.auth.commands.register_user import RegisterUserCommand, RegisterUserHandler
from src.auth.repository import UserReadRepository, UserWriteRepository
from src.users.queries.list_users import ListUsersHandler, ListUsersQuery


async def test_list_users_empty(mock_db):
    read_repo = UserReadRepository(mock_db)
    handler = ListUsersHandler(read_repo)

    result = await handler.handle(ListUsersQuery())
    assert result.items == []
    assert result.total == 0
    assert result.page == 1
    assert result.page_size == 20


async def test_list_users_returns_all(mock_db):
    write_repo = UserWriteRepository(mock_db)
    read_repo = UserReadRepository(mock_db)
    reg_handler = RegisterUserHandler(write_repo, read_repo)

    await reg_handler.handle(RegisterUserCommand(email="a@example.com", password="testpassword123"))
    await reg_handler.handle(RegisterUserCommand(email="b@example.com", password="testpassword123"))

    handler = ListUsersHandler(read_repo)
    result = await handler.handle(ListUsersQuery())
    assert len(result.items) == 2
    assert result.total == 2


async def test_list_users_pagination(mock_db):
    write_repo = UserWriteRepository(mock_db)
    read_repo = UserReadRepository(mock_db)
    reg_handler = RegisterUserHandler(write_repo, read_repo)

    for i in range(3):
        await reg_handler.handle(
            RegisterUserCommand(email=f"user{i}@example.com", password="testpassword123")
        )

    handler = ListUsersHandler(read_repo)

    page1 = await handler.handle(ListUsersQuery(page=1, page_size=2))
    assert len(page1.items) == 2
    assert page1.total == 3
    assert page1.page == 1

    page2 = await handler.handle(ListUsersQuery(page=2, page_size=2))
    assert len(page2.items) == 1
    assert page2.total == 3
    assert page2.page == 2
