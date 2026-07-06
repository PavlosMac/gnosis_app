from datetime import date

import pytest
from bson import ObjectId

from src.llm.mock_adapter import MockLLMAdapter
from src.llm.schemas import CardInSpread
from src.readings.commands.create_reading import CreateReadingCommand, CreateReadingHandler
from src.readings.queries.get_reading_by_id import GetReadingByIdHandler, GetReadingByIdQuery
from src.readings.queries.list_user_readings import (
    ListUserReadingsHandler,
    ListUserReadingsQuery,
)
from src.readings.repository import ReadingReadRepository, ReadingWriteRepository
from src.readings.service import ReadingNotFoundError


@pytest.fixture
def user_id():
    return str(ObjectId())


@pytest.fixture
def repos(mock_db):
    return ReadingWriteRepository(mock_db), ReadingReadRepository(mock_db)


@pytest.fixture
def create_handler(repos):
    write_repo, _ = repos
    return CreateReadingHandler(write_repo=write_repo, llm=MockLLMAdapter())


@pytest.fixture
def get_handler(repos):
    _, read_repo = repos
    return GetReadingByIdHandler(read_repo)


@pytest.fixture
def list_handler(repos):
    _, read_repo = repos
    return ListUserReadingsHandler(read_repo)


def _make_command(user_id: str, spread: str = "Celtic Cross") -> CreateReadingCommand:
    return CreateReadingCommand(
        user_id=user_id,
        spread_name=spread,
        question="What lies ahead?",
        cards=[
            CardInSpread(name="The Fool", position="Present", orientation="upright"),
        ],
    )


async def test_get_reading_by_id(create_handler, get_handler, user_id):
    created = await create_handler.handle(_make_command(user_id))
    result = await get_handler.handle(GetReadingByIdQuery(reading_id=created.id, user_id=user_id))
    assert result.id == created.id
    assert result.spread_type == "Celtic Cross"


async def test_get_reading_not_found(get_handler, user_id):
    with pytest.raises(ReadingNotFoundError):
        await get_handler.handle(GetReadingByIdQuery(reading_id=str(ObjectId()), user_id=user_id))


async def test_get_reading_wrong_user(create_handler, get_handler, user_id):
    created = await create_handler.handle(_make_command(user_id))
    other_user = str(ObjectId())
    with pytest.raises(ReadingNotFoundError):
        await get_handler.handle(GetReadingByIdQuery(reading_id=created.id, user_id=other_user))


async def test_list_user_readings_empty(list_handler, user_id):
    result = await list_handler.handle(ListUserReadingsQuery(user_id=user_id))
    assert result.items == []
    assert result.total == 0


async def test_list_user_readings_returns_own(create_handler, list_handler, user_id):
    await create_handler.handle(_make_command(user_id))
    await create_handler.handle(_make_command(user_id, spread="Three Card"))
    result = await list_handler.handle(ListUserReadingsQuery(user_id=user_id))
    assert len(result.items) == 2
    assert result.total == 2


async def test_list_user_readings_excludes_other_users(create_handler, list_handler, user_id):
    await create_handler.handle(_make_command(user_id))
    other_user = str(ObjectId())
    await create_handler.handle(_make_command(other_user))
    result = await list_handler.handle(ListUserReadingsQuery(user_id=user_id))
    assert len(result.items) == 1
    assert result.total == 1


async def test_list_user_readings_pagination(create_handler, list_handler, user_id):
    for _ in range(3):
        await create_handler.handle(_make_command(user_id))
    page1 = await list_handler.handle(ListUserReadingsQuery(user_id=user_id, page=1, page_size=2))
    assert len(page1.items) == 2
    assert page1.total == 3
    page2 = await list_handler.handle(ListUserReadingsQuery(user_id=user_id, page=2, page_size=2))
    assert len(page2.items) == 1
    assert page2.total == 3


async def test_list_user_readings_filter_by_spread_type(create_handler, list_handler, user_id):
    await create_handler.handle(_make_command(user_id, spread="Celtic Cross"))
    await create_handler.handle(_make_command(user_id, spread="Three Card"))
    result = await list_handler.handle(
        ListUserReadingsQuery(user_id=user_id, spread_type="Three Card")
    )
    assert len(result.items) == 1
    assert result.items[0].spread_type == "Three Card"


async def test_list_user_readings_filter_by_birth_date_matches(create_handler, list_handler, user_id):
    command = CreateReadingCommand(
        user_id=user_id,
        spread_name="Significators",
        birth_date=date(1990, 5, 1),
        cards=[CardInSpread(name="The Fool", position="Present", orientation="upright")],
    )
    await create_handler.handle(command)
    result = await list_handler.handle(
        ListUserReadingsQuery(user_id=user_id, birth_date=date(1990, 5, 1))
    )
    assert len(result.items) == 1


async def test_list_user_readings_filter_by_birth_date_excludes_non_matching(
    create_handler, list_handler, user_id
):
    await create_handler.handle(_make_command(user_id))
    result = await list_handler.handle(
        ListUserReadingsQuery(user_id=user_id, birth_date=date(1990, 5, 1))
    )
    assert result.items == []
    assert result.total == 0
