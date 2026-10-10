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


# --- ThrottleRepository: one collection, a key prefix per limiter ---


async def test_throttle_prefixes_keep_limiters_apart(mock_db):
    from src.auth.repository import ThrottleRepository

    login = ThrottleRepository(mock_db, key_prefix="login:")
    verify = ThrottleRepository(mock_db, key_prefix="verify:")
    now = datetime.now(UTC)
    await login.record_attempt("a@b.com", expires_at=now + timedelta(hours=1))

    assert await login.count_recent("a@b.com", since=now - timedelta(hours=1)) == 1
    assert await verify.count_recent("a@b.com", since=now - timedelta(hours=1)) == 0
    stored = await mock_db["password_reset_attempts"].find_one({})
    assert stored["key"] == "login:a@b.com"


async def test_throttle_is_over_limit_counts_its_own_attempt(mock_db):
    from src.auth.repository import ThrottleRepository

    repo = ThrottleRepository(mock_db, key_prefix="register:")

    assert await repo.is_over_limit("1.2.3.4", window_seconds=60, max_attempts=2) is False
    assert await repo.is_over_limit("1.2.3.4", window_seconds=60, max_attempts=2) is False
    assert await repo.is_over_limit("1.2.3.4", window_seconds=60, max_attempts=2) is True
    assert await repo.is_over_limit("5.6.7.8", window_seconds=60, max_attempts=2) is False


async def test_one_time_token_delete_all_removes_used_tokens_too(mock_db):
    from src.auth.repository import EmailVerificationTokenRepository

    repo = EmailVerificationTokenRepository(mock_db)
    expires = datetime.now(UTC) + timedelta(hours=1)
    await repo.store("h1", "user1", expires)
    await repo.store("h2", "user1", expires)
    await repo.store("h3", "user2", expires)
    await repo.consume("h1")

    await repo.delete_all_for_user("user1")

    assert await mock_db["email_verification_tokens"].count_documents({}) == 1
