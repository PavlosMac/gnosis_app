# ruff: noqa: E402
import os
from datetime import UTC, datetime

# Settings has no jwt_secret_key default (a committed fallback would let anyone forge
# tokens), so supply one before any src import instantiates Settings. setdefault keeps
# a real env var or .env value in charge when present.
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret")

import pytest
from bson import ObjectId
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

from src.auth.repository import AuthReadRepository, AuthWriteRepository
from src.database.mongodb import set_database
from src.interpretations.commands.generate_interpretation import (
    GenerateInterpretationHandler,
)
from src.interpretations.repository import (
    InterpretationReadRepository,
    InterpretationWriteRepository,
)
from src.llm.mock_adapter import MockLLMAdapter
from src.llm.port import LLMPort
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
    from src.notifications.mock_adapter import MockEmailAdapter

    # Same wiring as production (main._wire_mediator is the single owner of handler
    # registrations), just against the mock db and mock LLM.
    mediator = Mediator()
    mock_llm = MockLLMAdapter()
    mock_email = MockEmailAdapter()
    _wire_mediator(mediator, mock_llm, mock_email, mock_db)

    app.state.mediator = mediator
    app.state.refresh_token_repo = RefreshTokenRepository(mock_db)
    app.state.llm = mock_llm
    app.state.email = mock_email
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


@pytest.fixture
async def mock_email(app):
    return app.state.email


# --- Handler fixtures for unit tests that drive CQRS handlers directly ---


@pytest.fixture
async def user_id(mock_db):
    """A user that exists in the database — the budget gate's reserve matches on the
    user document, so handler-level tests need a real one."""
    oid = ObjectId()
    await mock_db["users"].insert_one(
        {"_id": oid, "email": f"{oid}@example.com", "created_at": datetime.now(UTC)}
    )
    return str(oid)


@pytest.fixture
def reading_repos(mock_db):
    return ReadingWriteRepository(mock_db), ReadingReadRepository(mock_db)


@pytest.fixture
def create_reading_handler(reading_repos):
    write_repo, _ = reading_repos
    return CreateReadingHandler(write_repo=write_repo)


@pytest.fixture
def generate_handler_factory(reading_repos, mock_db):
    """Same repo wiring as production (see main._wire_mediator), parametrized on the LLM
    adapter and the two write repos — tests that need a fake/failing/blocking adapter or
    a failing persist/settle build off this instead of re-deriving the wiring."""
    _, read_repo = reading_repos

    def _make(
        llm: LLMPort | None = None,
        interpretation_write_repo: InterpretationWriteRepository | None = None,
        user_write_repo: AuthWriteRepository | None = None,
    ) -> GenerateInterpretationHandler:
        return GenerateInterpretationHandler(
            reading_read_repo=read_repo,
            user_read_repo=AuthReadRepository(mock_db),
            user_write_repo=user_write_repo or AuthWriteRepository(mock_db),
            interpretation_read_repo=InterpretationReadRepository(mock_db),
            interpretation_write_repo=(
                interpretation_write_repo or InterpretationWriteRepository(mock_db)
            ),
            llm=llm or MockLLMAdapter(),
        )

    return _make


@pytest.fixture
def generate_handler(generate_handler_factory):
    return generate_handler_factory()


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
