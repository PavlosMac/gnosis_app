"""The card meanings reach every database through the API's own startup, not through a
one-shot migration: a deploy that ships a regenerated JSON re-seeds on its next start,
and a production database whose migration 016 was recorded before the seed existed
still gets the rows."""

from fastapi import FastAPI

from src.database.collections.constants import MAJOR_ARCANA_MEANINGS_COLLECTION
from src.main import lifespan


async def test_startup_seeds_all_22_card_meanings(mock_db, monkeypatch):
    async def no_connect() -> None: ...

    monkeypatch.setattr("src.main.connect_to_mongo", no_connect)
    monkeypatch.setattr("src.main.close_mongo_connection", no_connect)
    monkeypatch.setattr("src.main.get_database", lambda: mock_db)

    async with lifespan(FastAPI()):
        docs = [d async for d in mock_db[MAJOR_ARCANA_MEANINGS_COLLECTION].find({})]

    assert sorted(d["number"] for d in docs) == list(range(22))
    assert all(d["upright"] and d["shadow"] for d in docs)


async def test_startup_seed_is_idempotent_across_restarts(mock_db, monkeypatch):
    async def no_connect() -> None: ...

    monkeypatch.setattr("src.main.connect_to_mongo", no_connect)
    monkeypatch.setattr("src.main.close_mongo_connection", no_connect)
    monkeypatch.setattr("src.main.get_database", lambda: mock_db)

    async with lifespan(FastAPI()):
        pass
    async with lifespan(FastAPI()):
        pass

    assert await mock_db[MAJOR_ARCANA_MEANINGS_COLLECTION].count_documents({}) == 22
