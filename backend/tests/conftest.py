import pytest
from bson import ObjectId
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

from src.auth.repository import AuthWriteRepository
from src.database.mongodb import set_database
from src.interpretations.commands.generate_interpretation import (
    GenerateInterpretationCommand,
    GenerateInterpretationHandler,
)
from src.interpretations.commands.save_interpretation import (
    SaveInterpretationCommand,
    SaveInterpretationHandler,
)
from src.interpretations.queries.get_interpretations_by_reading_id import (
    GetInterpretationsByReadingIdHandler,
)
from src.interpretations.repository import (
    InterpretationReadRepository,
    InterpretationWriteRepository,
)
from src.llm.mock_adapter import MockLLMAdapter
from src.llm.schemas import CardInSpread
from src.readings.commands.create_reading import CreateReadingCommand, CreateReadingHandler
from src.readings.repository import ReadingReadRepository, ReadingWriteRepository


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
    from src.auth.repository import RefreshTokenRepository
    from src.cqrs.mediator import Mediator
    from src.llm.mock_adapter import MockLLMAdapter
    from src.main import _wire_mediator, app

    # Same wiring as production (main._wire_mediator is the single owner of handler
    # registrations), just against the mock db and mock LLM.
    mediator = Mediator()
    mock_llm = MockLLMAdapter()
    _wire_mediator(mediator, mock_llm, mock_db)

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


# --- Handler fixtures for unit tests that drive CQRS handlers directly ---


@pytest.fixture
def user_id():
    return str(ObjectId())


@pytest.fixture
def reading_repos(mock_db):
    return ReadingWriteRepository(mock_db), ReadingReadRepository(mock_db)


@pytest.fixture
def create_reading_handler(reading_repos):
    write_repo, _ = reading_repos
    return CreateReadingHandler(write_repo=write_repo)


@pytest.fixture
def generate_handler(reading_repos, mock_db):
    _, read_repo = reading_repos
    return GenerateInterpretationHandler(
        reading_read_repo=read_repo,
        user_write_repo=AuthWriteRepository(mock_db),
        llm=MockLLMAdapter(),
    )


@pytest.fixture
def save_handler(reading_repos, mock_db):
    _, read_repo = reading_repos
    return SaveInterpretationHandler(
        reading_read_repo=read_repo,
        write_repo=InterpretationWriteRepository(mock_db),
    )


@pytest.fixture
def interpretations_query_handler(mock_db):
    return GetInterpretationsByReadingIdHandler(InterpretationReadRepository(mock_db))


@pytest.fixture
def make_reading(create_reading_handler, user_id):
    """Async factory: create a one-card reading for user_id and return its read model."""

    async def _make():
        return await create_reading_handler.handle(
            CreateReadingCommand(
                user_id=user_id,
                spread_name="Celtic Cross",
                question="What lies ahead?",
                cards=[
                    CardInSpread(
                        name="The Fool",
                        position="Present",
                        orientation="upright",
                        position_description="Will, drive, and what energises the situation",
                    ),
                ],
            )
        )

    return _make


@pytest.fixture
def generate_and_save(generate_handler, save_handler, user_id):
    """Async factory: generate an interpretation for a reading and save it under
    settings.lens. Returns the generated response; read the saved slot back via
    interpretations_query_handler."""

    async def _run(reading_id, settings, synthesis=None):
        generated = await generate_handler.handle(
            GenerateInterpretationCommand(reading_id=reading_id, user_id=user_id, settings=settings)
        )
        await save_handler.handle(
            SaveInterpretationCommand(
                reading_id=reading_id,
                user_id=user_id,
                card_interpretations=generated.card_interpretations,
                synthesis=synthesis or generated.synthesis,
                model=generated.model,
                tokens_used=generated.tokens_used,
                settings=settings,
            )
        )
        return generated

    return _run
