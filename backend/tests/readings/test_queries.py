from datetime import UTC, date, datetime, timedelta

import pytest
from bson import ObjectId

from src.database.collections.constants import READINGS_COLLECTION
from src.interpretations.models import Interpretation
from src.interpretations.repository import (
    InterpretationReadRepository,
    InterpretationWriteRepository,
)
from src.llm.schemas import CardInSpread
from src.readings.commands.create_reading import CreateReadingCommand, CreateReadingHandler
from src.readings.commands.update_reading_tags import (
    UpdateReadingTagsCommand,
    UpdateReadingTagsHandler,
)
from src.readings.queries.get_reading_by_id import GetReadingByIdHandler, GetReadingByIdQuery
from src.readings.queries.list_user_readings import (
    ListUserReadingsHandler,
    ListUserReadingsQuery,
)
from src.readings.repository import (
    ReadingReadRepository,
    ReadingWriteRepository,
    UserTagsReadRepository,
    UserTagsWriteRepository,
)
from src.readings.service import ReadingNotFoundError


@pytest.fixture
def user_id():
    return str(ObjectId())


@pytest.fixture
def repos(mock_db):
    return ReadingWriteRepository(mock_db), ReadingReadRepository(mock_db)


@pytest.fixture
def user_tags_repos(mock_db):
    return UserTagsWriteRepository(mock_db), UserTagsReadRepository(mock_db)


@pytest.fixture
def create_handler(repos):
    write_repo, _ = repos
    return CreateReadingHandler(write_repo=write_repo)


@pytest.fixture
def get_handler(repos, mock_db):
    _, read_repo = repos
    return GetReadingByIdHandler(read_repo, InterpretationReadRepository(mock_db))


@pytest.fixture
def list_handler(repos, user_tags_repos):
    _, read_repo = repos
    _, user_tags_read_repo = user_tags_repos
    return ListUserReadingsHandler(read_repo, user_tags_read_repo)


@pytest.fixture
def update_tags_handler(repos, user_tags_repos):
    write_repo, read_repo = repos
    user_tags_write_repo, _ = user_tags_repos
    return UpdateReadingTagsHandler(
        write_repo=write_repo, read_repo=read_repo, user_tags_write_repo=user_tags_write_repo
    )


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
    assert result.interpretation is None


async def test_get_reading_by_id_includes_the_stored_interpretation(
    create_handler, get_handler, user_id, mock_db
):
    created = await create_handler.handle(_make_command(user_id))
    interpretation = Interpretation(
        reading_id=created.id,
        user_id=user_id,
        reading="A journey begins.",
        model="mock",
    )
    await InterpretationWriteRepository(mock_db).upsert_by_reading_id(
        created.id, interpretation.to_document()
    )

    result = await get_handler.handle(GetReadingByIdQuery(reading_id=created.id, user_id=user_id))

    assert result.interpretation is not None
    assert result.interpretation.reading == "A journey begins."


async def test_get_reading_not_found(get_handler, user_id):
    with pytest.raises(ReadingNotFoundError):
        await get_handler.handle(GetReadingByIdQuery(reading_id=str(ObjectId()), user_id=user_id))


async def test_get_reading_malformed_id_returns_not_found(get_handler, user_id):
    """reading_id comes straight off the URL path with no format validation — the
    reading and interpretation lookups run concurrently, so a malformed id must 404
    like the ownership check does, not raise InvalidId."""
    with pytest.raises(ReadingNotFoundError):
        await get_handler.handle(
            GetReadingByIdQuery(reading_id="not-an-object-id", user_id=user_id)
        )


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


async def test_list_user_readings_filter_by_birth_date_matches(
    create_handler, list_handler, user_id
):
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


async def _create_dated_readings(create_handler, mock_db, user_id, spreads):
    """Create one reading per spread name, each a day newer than the last — readings
    made back to back can share a created_at, so order tests pin the dates themselves."""
    base = datetime(2026, 1, 1, tzinfo=UTC)
    created = []
    for offset, spread in enumerate(spreads):
        reading = await create_handler.handle(_make_command(user_id, spread=spread))
        await mock_db[READINGS_COLLECTION].update_one(
            {"_id": ObjectId(reading.id)},
            {"$set": {"created_at": base + timedelta(days=offset)}},
        )
        created.append(reading)
    return created


async def test_list_user_readings_defaults_to_newest_first(
    create_handler, list_handler, mock_db, user_id
):
    await _create_dated_readings(create_handler, mock_db, user_id, ["First", "Second", "Third"])

    default = await list_handler.handle(ListUserReadingsQuery(user_id=user_id))
    newest = await list_handler.handle(ListUserReadingsQuery(user_id=user_id, sort="created_at"))

    assert [item.spread_type for item in default.items] == ["Third", "Second", "First"]
    assert [item.spread_type for item in newest.items] == ["Third", "Second", "First"]


async def test_list_user_readings_sort_oldest_first(create_handler, list_handler, mock_db, user_id):
    await _create_dated_readings(create_handler, mock_db, user_id, ["First", "Second", "Third"])

    page1 = await list_handler.handle(
        ListUserReadingsQuery(user_id=user_id, sort="created_at", order="asc", page=1, page_size=2)
    )
    page2 = await list_handler.handle(
        ListUserReadingsQuery(user_id=user_id, sort="created_at", order="asc", page=2, page_size=2)
    )

    assert [item.spread_type for item in page1.items] == ["First", "Second"]
    assert [item.spread_type for item in page2.items] == ["Third"]


async def test_list_user_readings_ignores_order_without_sort(
    create_handler, list_handler, update_tags_handler, mock_db, user_id
):
    """`order` is a direction for `sort`; on its own it must not flip the newest-first
    default, with or without a tag filter."""
    first, second, third = await _create_dated_readings(
        create_handler, mock_db, user_id, ["First", "Second", "Third"]
    )
    await update_tags_handler.handle(
        UpdateReadingTagsCommand(reading_id=first.id, user_id=user_id, tags=["career", "love"])
    )
    await update_tags_handler.handle(
        UpdateReadingTagsCommand(reading_id=third.id, user_id=user_id, tags=["career"])
    )

    plain = await list_handler.handle(ListUserReadingsQuery(user_id=user_id, order="asc"))
    tagged = await list_handler.handle(
        ListUserReadingsQuery(user_id=user_id, tags=["career", "love"], order="asc")
    )

    assert [item.spread_type for item in plain.items] == ["Third", "Second", "First"]
    assert [item.spread_type for item in tagged.items] == ["Third", "First"]


async def test_list_user_readings_filter_by_tags_keeps_date_order(
    create_handler, list_handler, update_tags_handler, mock_db, user_id
):
    """A tag filter narrows the list but never reorders it: matches come newest first
    like everything else, and an explicit sort applies within the filter."""
    two_match, one_match, no_match = await _create_dated_readings(
        create_handler, mock_db, user_id, ["Two Match", "One Match", "No Match"]
    )
    await update_tags_handler.handle(
        UpdateReadingTagsCommand(reading_id=two_match.id, user_id=user_id, tags=["career", "love"])
    )
    await update_tags_handler.handle(
        UpdateReadingTagsCommand(reading_id=one_match.id, user_id=user_id, tags=["career"])
    )
    await update_tags_handler.handle(
        UpdateReadingTagsCommand(reading_id=no_match.id, user_id=user_id, tags=["luck"])
    )

    default = await list_handler.handle(
        ListUserReadingsQuery(user_id=user_id, tags=["career", "love"])
    )
    oldest = await list_handler.handle(
        ListUserReadingsQuery(
            user_id=user_id, tags=["career", "love"], sort="created_at", order="asc"
        )
    )

    # One Match is the newer of the two matches; the number of matching tags is
    # irrelevant to the order, and No Match stays out
    assert [item.spread_type for item in default.items] == ["One Match", "Two Match"]
    assert [item.spread_type for item in oldest.items] == ["Two Match", "One Match"]
    assert default.total == 2
    assert oldest.total == 2


async def test_list_user_readings_user_tags_empty_without_document(
    create_handler, list_handler, user_id
):
    await create_handler.handle(_make_command(user_id))
    result = await list_handler.handle(ListUserReadingsQuery(user_id=user_id))
    assert result.user_tags == []


async def test_list_user_readings_returns_stored_user_tags(
    create_handler, list_handler, update_tags_handler, user_id
):
    """The vocabulary is the user's full tag set — untouched by the list's filters
    or page size, so the front-end can cache it across requests."""
    first = await create_handler.handle(_make_command(user_id, spread="Celtic Cross"))
    second = await create_handler.handle(_make_command(user_id, spread="Three Card"))
    other_user = str(ObjectId())
    theirs = await create_handler.handle(_make_command(other_user))

    await update_tags_handler.handle(
        UpdateReadingTagsCommand(reading_id=first.id, user_id=user_id, tags=["career", "love"])
    )
    await update_tags_handler.handle(
        UpdateReadingTagsCommand(reading_id=second.id, user_id=user_id, tags=["career"])
    )
    await update_tags_handler.handle(
        UpdateReadingTagsCommand(reading_id=theirs.id, user_id=other_user, tags=["luck"])
    )

    result = await list_handler.handle(
        ListUserReadingsQuery(user_id=user_id, spread_type="Three Card", tags=["love"], page_size=1)
    )

    assert [(t.name, t.count) for t in result.user_tags] == [("career", 2), ("love", 1)]
    assert result.total == 0
