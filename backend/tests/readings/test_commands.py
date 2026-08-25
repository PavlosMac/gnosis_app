import pytest
from bson import ObjectId

from src.llm.schemas import CardInSpread
from src.readings.commands.create_reading import CreateReadingCommand, CreateReadingHandler
from src.readings.commands.update_reading_tags import (
    UpdateReadingTagsCommand,
    UpdateReadingTagsHandler,
)
from src.readings.repository import ReadingReadRepository, ReadingWriteRepository
from src.readings.service import ReadingNotFoundError


@pytest.fixture
def handler(mock_db):
    return CreateReadingHandler(write_repo=ReadingWriteRepository(mock_db))


@pytest.fixture
def valid_command():
    return CreateReadingCommand(
        user_id=str(ObjectId()),
        spread_name="Celtic Cross",
        question="What does the future hold?",
        cards=[
            CardInSpread(
                name="The Fool",
                position="Present",
                orientation="upright",
            ),
        ],
    )


@pytest.fixture
def update_tags_handler(mock_db):
    return UpdateReadingTagsHandler(
        write_repo=ReadingWriteRepository(mock_db),
        read_repo=ReadingReadRepository(mock_db),
    )


async def test_create_reading_returns_read_model(handler, valid_command):
    result = await handler.handle(valid_command)
    assert result.id is not None
    assert result.user_id == valid_command.user_id
    assert result.spread_type == "Celtic Cross"
    assert result.question == "What does the future hold?"
    assert len(result.cards) == 1
    assert result.cards[0].name == "The Fool"
    assert result.interpretations == []


async def test_create_reading_persists_to_db(handler, valid_command, mock_db):
    result = await handler.handle(valid_command)
    read_repo = ReadingReadRepository(mock_db)
    doc = await read_repo.find_by_id(result.id)
    assert doc is not None
    assert str(doc["user_id"]) == valid_command.user_id
    assert doc["spread_type"] == "Celtic Cross"


async def test_create_reading_without_question(handler):
    command = CreateReadingCommand(
        user_id=str(ObjectId()),
        spread_name="Three Card",
        cards=[
            CardInSpread(name="The Fool", position="Past", orientation="reversed"),
        ],
    )
    result = await handler.handle(command)
    assert result.question is None
    assert result.cards[0].orientation == "reversed"


async def test_create_reading_persists_position_description(handler):
    command = CreateReadingCommand(
        user_id=str(ObjectId()),
        spread_name="Celtic Cross",
        cards=[
            CardInSpread(
                name="The Fool",
                position="Present",
                orientation="upright",
                position_description="Will, drive, and what energises the situation",
            ),
        ],
    )
    result = await handler.handle(command)
    assert result.cards[0].position_description == ("Will, drive, and what energises the situation")


async def test_update_reading_tags_sets_tags(handler, valid_command, update_tags_handler):
    created = await handler.handle(valid_command)
    result = await update_tags_handler.handle(
        UpdateReadingTagsCommand(
            reading_id=created.id, user_id=valid_command.user_id, tags=["career", "love"]
        )
    )
    assert result.tags == ["career", "love"]


async def test_update_reading_tags_persists(handler, valid_command, update_tags_handler, mock_db):
    created = await handler.handle(valid_command)
    await update_tags_handler.handle(
        UpdateReadingTagsCommand(
            reading_id=created.id, user_id=valid_command.user_id, tags=["career"]
        )
    )
    read_repo = ReadingReadRepository(mock_db)
    doc = await read_repo.find_by_id(created.id)
    assert doc["tags"] == ["career"]


async def test_update_reading_tags_replaces_existing(handler, valid_command, update_tags_handler):
    created = await handler.handle(valid_command)
    await update_tags_handler.handle(
        UpdateReadingTagsCommand(
            reading_id=created.id, user_id=valid_command.user_id, tags=["career", "love"]
        )
    )
    result = await update_tags_handler.handle(
        UpdateReadingTagsCommand(
            reading_id=created.id, user_id=valid_command.user_id, tags=["luck"]
        )
    )
    assert result.tags == ["luck"]


async def test_update_reading_tags_not_found(update_tags_handler, valid_command):
    with pytest.raises(ReadingNotFoundError):
        await update_tags_handler.handle(
            UpdateReadingTagsCommand(
                reading_id=str(ObjectId()), user_id=valid_command.user_id, tags=["career"]
            )
        )


async def test_update_reading_tags_wrong_user(handler, valid_command, update_tags_handler):
    created = await handler.handle(valid_command)
    with pytest.raises(ReadingNotFoundError):
        await update_tags_handler.handle(
            UpdateReadingTagsCommand(
                reading_id=created.id, user_id=str(ObjectId()), tags=["career"]
            )
        )
