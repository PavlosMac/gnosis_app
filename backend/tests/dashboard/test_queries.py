from datetime import UTC, datetime, timedelta

import pytest
from bson import ObjectId

from src.auth.repository import AuthReadRepository
from src.core.config import settings
from src.core.exceptions import UnauthorizedError
from src.dashboard.queries.get_dashboard_by_user_id import (
    GetDashboardByUserIdHandler,
    GetDashboardByUserIdQuery,
)
from src.interpretations.models import Interpretation
from src.interpretations.repository import (
    InterpretationReadRepository,
    InterpretationWriteRepository,
)
from src.readings.repository import UserTagsReadRepository, UserTagsWriteRepository


@pytest.fixture
def dashboard_handler(reading_repos, mock_db):
    _, read_repo = reading_repos
    return GetDashboardByUserIdHandler(
        AuthReadRepository(mock_db),
        read_repo,
        UserTagsReadRepository(mock_db),
        InterpretationReadRepository(mock_db),
    )


async def test_get_dashboard_no_readings(dashboard_handler, user_id):
    result = await dashboard_handler.handle(GetDashboardByUserIdQuery(user_id=user_id))

    assert result.user.id == user_id
    assert result.user.email == f"{user_id}@example.com"
    assert result.last_reading is None
    assert result.total_readings == 0
    assert result.remaining_budget_usd == settings.user_budget_usd
    assert result.budget_usd == settings.user_budget_usd
    assert result.user_tags == []


async def test_get_dashboard_returns_latest_reading_with_interpretation(
    dashboard_handler, user_id, make_reading, mock_db
):
    older = await make_reading()
    # Both are created within the same millisecond, so pin the first one earlier — the
    # query orders by created_at, not by insertion.
    await mock_db["readings"].update_one(
        {"_id": ObjectId(older.id)},
        {"$set": {"created_at": datetime.now(UTC) - timedelta(minutes=1)}},
    )
    newer = await make_reading()
    await InterpretationWriteRepository(mock_db).upsert_by_reading_id(
        newer.id,
        Interpretation(
            reading_id=newer.id, user_id=user_id, reading="A journey begins.", model="mock"
        ).to_document(),
    )

    result = await dashboard_handler.handle(GetDashboardByUserIdQuery(user_id=user_id))

    assert result.total_readings == 2
    assert result.last_reading is not None
    assert result.last_reading.id == newer.id
    assert result.last_reading.interpretation is not None
    assert result.last_reading.interpretation.reading == "A journey begins."


async def test_get_dashboard_last_reading_without_interpretation(
    dashboard_handler, user_id, make_reading
):
    created = await make_reading()

    result = await dashboard_handler.handle(GetDashboardByUserIdQuery(user_id=user_id))

    assert result.last_reading is not None
    assert result.last_reading.id == created.id
    assert result.last_reading.interpretation is None


async def test_get_dashboard_remaining_budget_uses_override_and_usage(
    dashboard_handler, user_id, mock_db
):
    await mock_db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"budget_usd": 2.0, "usage": {"cost_usd": 0.75}}},
    )

    result = await dashboard_handler.handle(GetDashboardByUserIdQuery(user_id=user_id))

    assert result.remaining_budget_usd == 1.25
    assert result.budget_usd == 2.0


async def test_get_dashboard_zero_budget_override_is_zero(dashboard_handler, user_id, mock_db):
    await mock_db["users"].update_one({"_id": ObjectId(user_id)}, {"$set": {"budget_usd": 0}})

    result = await dashboard_handler.handle(GetDashboardByUserIdQuery(user_id=user_id))

    assert result.remaining_budget_usd == 0.0


async def test_get_dashboard_user_missing_raises_unauthorized(dashboard_handler):
    with pytest.raises(UnauthorizedError):
        await dashboard_handler.handle(GetDashboardByUserIdQuery(user_id=str(ObjectId())))


async def test_get_dashboard_malformed_user_id_raises_unauthorized(dashboard_handler):
    """A malformed sub claim must hit the same 401 path as a deleted user, not surface
    as an InvalidId 500 from one of the concurrent repo calls."""
    with pytest.raises(UnauthorizedError):
        await dashboard_handler.handle(GetDashboardByUserIdQuery(user_id="not-an-object-id"))


async def test_get_dashboard_carries_tag_vocabulary(dashboard_handler, user_id, mock_db):
    await UserTagsWriteRepository(mock_db).replace_for_user(
        user_id, [{"name": "career", "count": 2}, {"name": "love", "count": 1}]
    )

    result = await dashboard_handler.handle(GetDashboardByUserIdQuery(user_id=user_id))

    assert [(t.name, t.count) for t in result.user_tags] == [("career", 2), ("love", 1)]
