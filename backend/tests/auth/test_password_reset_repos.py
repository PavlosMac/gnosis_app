from datetime import UTC, datetime, timedelta

from src.auth.repository import (
    PasswordResetThrottleRepository,
    PasswordResetTokenRepository,
    RefreshTokenRepository,
)


async def test_consume_returns_doc_once_then_none(mock_db):
    repo = PasswordResetTokenRepository(mock_db)
    expires = datetime.now(UTC) + timedelta(minutes=30)
    await repo.store("hash1", "user1", expires_at=expires)

    doc = await repo.consume("hash1")
    assert doc is not None
    assert doc["user_id"] == "user1"

    assert await repo.consume("hash1") is None  # single-use


async def test_consume_unknown_hash_returns_none(mock_db):
    repo = PasswordResetTokenRepository(mock_db)
    assert await repo.consume("nope") is None


async def test_consume_does_not_filter_expired(mock_db):
    # The handler owns the 400-vs-410 split, so consume must return stale docs.
    repo = PasswordResetTokenRepository(mock_db)
    await repo.store("hash1", "user1", expires_at=datetime.now(UTC) - timedelta(minutes=1))
    assert await repo.consume("hash1") is not None


async def test_invalidate_all_removes_unused_tokens(mock_db):
    repo = PasswordResetTokenRepository(mock_db)
    expires = datetime.now(UTC) + timedelta(minutes=30)
    await repo.store("hash1", "user1", expires_at=expires)
    await repo.store("hash2", "user1", expires_at=expires)
    await repo.store("hash3", "other", expires_at=expires)

    await repo.invalidate_all_for_user("user1")
    assert await repo.consume("hash1") is None
    assert await repo.consume("hash2") is None
    assert await repo.consume("hash3") is not None  # other user untouched


async def test_count_recent_only_counts_key_within_window(mock_db):
    repo = PasswordResetThrottleRepository(mock_db)
    now = datetime.now(UTC)
    await repo.record_attempt("a@b.com", expires_at=now + timedelta(hours=1))
    await repo.record_attempt("a@b.com", expires_at=now + timedelta(hours=1))
    await repo.record_attempt("other@b.com", expires_at=now + timedelta(hours=1))

    assert await repo.count_recent("a@b.com", since=now - timedelta(hours=1)) == 2
    assert await repo.count_recent("a@b.com", since=now + timedelta(seconds=5)) == 0


async def test_revoke_all_for_user_deletes_only_their_tokens(mock_db):
    repo = RefreshTokenRepository(mock_db)
    expires = datetime.now(UTC) + timedelta(days=1)
    await repo.store("jti1", "fam1", "user1", expires)
    await repo.store("jti2", "fam2", "user1", expires)
    await repo.store("jti3", "fam3", "other", expires)

    await repo.revoke_all_for_user("user1")
    assert await repo.consume("jti1") is None
    assert await repo.consume("jti2") is None
    assert await repo.consume("jti3") is not None
