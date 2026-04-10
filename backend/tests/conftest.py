import pytest
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

from src.database.mongodb import set_database


@pytest.fixture(autouse=True)
async def mock_db():
    client = AsyncMongoMockClient()
    db = client["test_gnosis_esoterica"]
    set_database(db)
    yield db
    # Drop all collections after each test
    for name in await db.list_collection_names():
        await db.drop_collection(name)
    set_database(None)


@pytest.fixture
async def app(mock_db):
    from src.auth.commands.register_user import RegisterUserCommand, RegisterUserHandler
    from src.auth.queries.get_user_by_email import GetUserByEmailHandler, GetUserByEmailQuery
    from src.auth.queries.get_user_by_id import GetUserByIdHandler, GetUserByIdQuery
    from src.auth.repository import (
        AuthReadRepository,
        AuthWriteRepository,
        RefreshTokenRepository,
    )
    from src.cqrs.mediator import Mediator
    from src.llm.mock_adapter import MockLLMAdapter
    from src.main import app
    from src.readings.commands.create_reading import CreateReadingCommand, CreateReadingHandler
    from src.readings.queries.get_reading_by_id import (
        GetReadingByIdHandler,
        GetReadingByIdQuery,
    )
    from src.readings.queries.list_user_readings import (
        ListUserReadingsHandler,
        ListUserReadingsQuery,
    )
    from src.readings.repository import ReadingReadRepository, ReadingWriteRepository
    from src.users.queries.list_users import ListUsersHandler, ListUsersQuery

    mediator = Mediator()
    user_write_repo = AuthWriteRepository(mock_db)
    user_read_repo = AuthReadRepository(mock_db)

    mediator.register_command(
        RegisterUserCommand, RegisterUserHandler(user_write_repo, user_read_repo)
    )
    mediator.register_query(GetUserByIdQuery, GetUserByIdHandler(user_read_repo))
    mediator.register_query(GetUserByEmailQuery, GetUserByEmailHandler(user_read_repo))
    mediator.register_query(ListUsersQuery, ListUsersHandler(user_read_repo))

    mock_llm = MockLLMAdapter()
    reading_write_repo = ReadingWriteRepository(mock_db)
    reading_read_repo = ReadingReadRepository(mock_db)

    mediator.register_command(
        CreateReadingCommand, CreateReadingHandler(reading_write_repo, mock_llm)
    )
    mediator.register_query(GetReadingByIdQuery, GetReadingByIdHandler(reading_read_repo))
    mediator.register_query(
        ListUserReadingsQuery, ListUserReadingsHandler(reading_read_repo)
    )

    app.state.mediator = mediator
    app.state.refresh_token_repo = RefreshTokenRepository(mock_db)
    app.state.llm = mock_llm
    return app


@pytest.fixture
async def superadmin_token(client, mock_db):
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "admin@example.com", "password": "securepassword123"},
    )
    assert reg.status_code == 201, f"Registration failed: {reg.text}"
    await mock_db["users"].update_one(
        {"email": "admin@example.com"}, {"$set": {"is_superadmin": True}}
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "securepassword123"},
    )
    assert login.status_code == 200, f"Login failed: {login.text}"
    return login.json()["access_token"]


@pytest.fixture
async def auth_token(client):
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "user@example.com", "password": "securepassword123"},
    )
    assert reg.status_code == 201, f"Registration failed: {reg.text}"
    return reg.json()["access_token"]


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac
