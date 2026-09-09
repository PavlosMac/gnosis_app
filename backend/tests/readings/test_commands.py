import pytest
from bson import ObjectId

from src.database.collections.constants import USER_TAGS_COLLECTION
from src.llm.schemas import CardInSpread
from src.readings.commands.create_reading import CreateReadingCommand, CreateReadingHandler
from src.readings.commands.update_reading_tags import (
    UpdateReadingTagsCommand,
    UpdateReadingTagsHandler,
)
from src.readings.repository import (
    ReadingReadRepository,
    ReadingWriteRepository,
    UserTagsWriteRepository,
)
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
        user_tags_write_repo=UserTagsWriteRepository(mock_db),
    )


async def test_create_reading_returns_read_model(handler, valid_command):
    result = await handler.handle(valid_command)
    assert result.id is not None
    assert result.user_id == valid_command.user_id
    assert result.spread_type == "Celtic Cross"
    assert result.question == "What does the future hold?"
    assert len(result.cards) == 1
    assert result.cards[0].name == "The Fool"
    assert result.interpretation is None


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


async def test_update_reading_tags_rewrites_user_tags_document(
    handler, valid_command, update_tags_handler, mock_db
):
    """The per-user vocabulary is derived state: every tag edit rebuilds it from that
    user's readings, so counts and order (most-used first, then name) always match."""
    user_id = valid_command.user_id
    first = await handler.handle(valid_command)
    second = await handler.handle(valid_command)

    await update_tags_handler.handle(
        UpdateReadingTagsCommand(reading_id=first.id, user_id=user_id, tags=["love", "career"])
    )
    await update_tags_handler.handle(
        UpdateReadingTagsCommand(reading_id=second.id, user_id=user_id, tags=["career"])
    )

    doc = await mock_db[USER_TAGS_COLLECTION].find_one({"user_id": ObjectId(user_id)})
    assert doc["tags"] == [{"name": "career", "count": 2}, {"name": "love", "count": 1}]
    assert doc["updated_at"] is not None

    await update_tags_handler.handle(
        UpdateReadingTagsCommand(reading_id=first.id, user_id=user_id, tags=[])
    )

    doc = await mock_db[USER_TAGS_COLLECTION].find_one({"user_id": ObjectId(user_id)})
    assert doc["tags"] == [{"name": "career", "count": 1}]
    assert await mock_db[USER_TAGS_COLLECTION].count_documents({}) == 1


async def test_update_reading_tags_user_tags_scoped_to_owner(
    handler, valid_command, update_tags_handler, mock_db
):
    other_user = str(ObjectId())
    mine = await handler.handle(valid_command)
    theirs = await handler.handle(valid_command.model_copy(update={"user_id": other_user}))

    await update_tags_handler.handle(
        UpdateReadingTagsCommand(reading_id=theirs.id, user_id=other_user, tags=["luck"])
    )
    await update_tags_handler.handle(
        UpdateReadingTagsCommand(reading_id=mine.id, user_id=valid_command.user_id, tags=["career"])
    )

    doc = await mock_db[USER_TAGS_COLLECTION].find_one({"user_id": ObjectId(valid_command.user_id)})
    assert doc["tags"] == [{"name": "career", "count": 1}]


async def test_create_reading_without_position(handler, mock_db):
    command = CreateReadingCommand(
        user_id=str(ObjectId()),
        spread_name="Three Card Relationship",
        cards=[CardInSpread(name="The Fool", orientation="upright")],
    )
    result = await handler.handle(command)
    assert result.cards[0].position is None

    doc = await mock_db["readings"].find_one({"_id": ObjectId(result.id)})
    assert "position" not in doc["cards"][0]
    assert "position_description" not in doc["cards"][0]
