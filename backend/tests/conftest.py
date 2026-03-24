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
    from src.auth.repository import UserReadRepository, UserWriteRepository
    from src.auth.token_blacklist_repository import TokenBlacklistRepository
    from src.cqrs.mediator import Mediator
    from src.main import app

    mediator = Mediator()
    user_write_repo = UserWriteRepository(mock_db)
    user_read_repo = UserReadRepository(mock_db)

    mediator.register_command(
        RegisterUserCommand, RegisterUserHandler(user_write_repo, user_read_repo)
    )
    mediator.register_query(GetUserByIdQuery, GetUserByIdHandler(user_read_repo))
    mediator.register_query(GetUserByEmailQuery, GetUserByEmailHandler(user_read_repo))

    app.state.mediator = mediator
    app.state.token_blacklist_repo = TokenBlacklistRepository(mock_db)
    return app


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac
