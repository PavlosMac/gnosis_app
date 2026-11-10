import types
from unittest.mock import AsyncMock

import pytest
from structlog.testing import capture_logs

from src.migrations.runner import MIGRATIONS_COLLECTION, run_migrations


def _make_migration(version: str, description: str = "test") -> types.ModuleType:
    m = types.ModuleType(f"migration_{version}")
    m.version = version
    m.description = description
    m.up = AsyncMock()
    return m


async def test_run_migrations_applies_pending(mock_db, monkeypatch):
    migration = _make_migration("001")
    monkeypatch.setattr("src.migrations.runner.discover_migrations", lambda: [migration])

    await run_migrations(mock_db)

    migration.up.assert_awaited_once_with(mock_db)
    doc = await mock_db[MIGRATIONS_COLLECTION].find_one({"version": "001"})
    assert doc is not None
    assert doc["description"] == "test"
    assert "applied_at" in doc


async def test_run_migrations_skips_already_applied(mock_db, monkeypatch):
    await mock_db[MIGRATIONS_COLLECTION].insert_one({"version": "001", "description": "test"})
    migration = _make_migration("001")
    monkeypatch.setattr("src.migrations.runner.discover_migrations", lambda: [migration])

    await run_migrations(mock_db)

    migration.up.assert_not_awaited()


async def test_run_migrations_applies_in_order(mock_db, monkeypatch):
    order: list[str] = []
    m1 = _make_migration("001")
    m2 = _make_migration("002")
    m1.up = AsyncMock(side_effect=lambda db: order.append("001"))
    m2.up = AsyncMock(side_effect=lambda db: order.append("002"))
    monkeypatch.setattr("src.migrations.runner.discover_migrations", lambda: [m1, m2])

    await run_migrations(mock_db)

    assert order == ["001", "002"]


async def test_run_migrations_crashes_on_failure(mock_db, monkeypatch):
    migration = _make_migration("001")
    migration.up = AsyncMock(side_effect=RuntimeError("index creation failed"))
    monkeypatch.setattr("src.migrations.runner.discover_migrations", lambda: [migration])

    with pytest.raises(RuntimeError, match="index creation failed"):
        await run_migrations(mock_db)

    doc = await mock_db[MIGRATIONS_COLLECTION].find_one({"version": "001"})
    assert doc is None


async def test_run_migrations_logs_latest_applied_version_when_up_to_date(mock_db, monkeypatch):
    for version in ("001", "002"):
        await mock_db[MIGRATIONS_COLLECTION].insert_one({"version": version, "description": "t"})
    migrations = [_make_migration("001"), _make_migration("002")]
    monkeypatch.setattr("src.migrations.runner.discover_migrations", lambda: migrations)

    with capture_logs() as logs:
        await run_migrations(mock_db)

    event = next(log for log in logs if log["event"] == "migrations up to date")
    assert event["version"] == "002"


async def test_run_migrations_logs_no_version_when_nothing_exists(mock_db, monkeypatch):
    monkeypatch.setattr("src.migrations.runner.discover_migrations", lambda: [])

    with capture_logs() as logs:
        await run_migrations(mock_db)

    event = next(log for log in logs if log["event"] == "migrations up to date")
    assert event["version"] is None


async def test_run_migrations_logs_count_and_last_version_after_applying(mock_db, monkeypatch):
    migrations = [_make_migration("001"), _make_migration("002")]
    monkeypatch.setattr("src.migrations.runner.discover_migrations", lambda: migrations)

    with capture_logs() as logs:
        await run_migrations(mock_db)

    event = next(log for log in logs if log["event"] == "migrations applied")
    assert event["count"] == 2
    assert event["version"] == "002"
