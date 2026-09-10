from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from src.readings.repository import UserTagsReadRepository, UserTagsWriteRepository


async def test_replace_for_user_creates_new_document(mock_db):
    write_repo = UserTagsWriteRepository(mock_db)
    read_repo = UserTagsReadRepository(mock_db)
    user_id = str(ObjectId())

    await write_repo.replace_for_user(user_id, [{"name": "career", "count": 1}])

    doc = await read_repo.find_by_user_id(user_id)
    assert doc["tags"] == [{"name": "career", "count": 1}]


async def test_replace_for_user_retries_as_plain_update_on_duplicate_key_race(mock_db, monkeypatch):
    """replace_one(upsert=True) against the unique user_id index can still raise E11000
    when two requests race the same brand-new key — the same documented Mongo upsert-race
    caveat InterpretationWriteRepository.upsert_by_reading_id already handles. The retry
    must fall back to a plain update against the now-existing document rather than crash."""
    write_repo = UserTagsWriteRepository(mock_db)
    read_repo = UserTagsReadRepository(mock_db)
    user_id = str(ObjectId())
    # Simulate a concurrent request having already created the document by the time
    # ours attempts its upsert.
    await write_repo.replace_for_user(user_id, [{"name": "luck", "count": 1}])

    original = write_repo._collection.replace_one
    raised = False

    async def replace_one_racy(filter_, replacement, *, upsert=False):
        nonlocal raised
        if upsert and not raised:
            raised = True
            raise DuplicateKeyError("E11000 duplicate key error collection")
        return await original(filter_, replacement, upsert=upsert)

    monkeypatch.setattr(write_repo._collection, "replace_one", replace_one_racy)

    await write_repo.replace_for_user(user_id, [{"name": "career", "count": 2}])

    doc = await read_repo.find_by_user_id(user_id)
    assert doc["tags"] == [{"name": "career", "count": 2}]
    assert await mock_db["user_tags"].count_documents({}) == 1
