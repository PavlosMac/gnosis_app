from datetime import UTC, datetime, timedelta

import pytest

from src.auth.commands.register_user import RegisterUserCommand, RegisterUserHandler
from src.auth.repository import (
    AuthReadRepository,
    AuthWriteRepository,
    EmailVerificationTokenRepository,
    ThrottleRepository,
)
from src.auth.service import EmailAlreadyExistsError


def _handler(mock_db) -> RegisterUserHandler:
    return RegisterUserHandler(
        AuthWriteRepository(mock_db),
        AuthReadRepository(mock_db),
        ThrottleRepository(mock_db, key_prefix="register:"),
    )


def _command(email: str, **overrides) -> RegisterUserCommand:
    fields = {
        "email": email,
        "password": "testpassword123",
        "first_name": "Command",
        "last_name": "User",
        "terms_version": "2026-10-04",
        "privacy_version": "2026-10-04",
        **overrides,
    }
    return RegisterUserCommand(**fields)


async def test_register_user_command(mock_db):
    read_repo = AuthReadRepository(mock_db)

    user_id = await _handler(mock_db).handle(
        _command("cmd@example.com", first_name="  Command ", last_name="User")
    )
    assert user_id is not None

    doc = await read_repo.find_by_email("cmd@example.com")
    assert doc is not None
    assert doc["first_name"] == "Command"
    assert doc["last_name"] == "User"
    assert doc["display_name"] == "Command User"
    assert doc["credits"] == 0
    assert doc["status"] == "pending_verification"


async def test_register_user_stores_consents_with_accepted_at(mock_db):
    read_repo = AuthReadRepository(mock_db)
    before = datetime.now(UTC).replace(tzinfo=None) - timedelta(seconds=1)

    await _handler(mock_db).handle(
        _command("consent@example.com", terms_version="2026-09-30", privacy_version="2026-10-01")
    )

    doc = await read_repo.find_by_email("consent@example.com")
    assert doc["consents"]["terms"]["version"] == "2026-09-30"
    assert doc["consents"]["privacy"]["version"] == "2026-10-01"
    for key in ("terms", "privacy"):
        accepted_at = doc["consents"][key]["accepted_at"].replace(tzinfo=None)
        assert accepted_at >= before


async def test_register_user_lowercases_the_email(mock_db):
    await _handler(mock_db).handle(_command("  MiXed@Example.com "))

    assert await mock_db["users"].find_one({"email": "mixed@example.com"}) is not None


async def test_register_user_duplicate_email(mock_db):
    handler = _handler(mock_db)
    await handler.handle(_command("dup@example.com"))

    with pytest.raises(EmailAlreadyExistsError):
        await handler.handle(_command("dup@example.com"))


# --- DeleteUserCommand: the erasure cascade ---


async def test_delete_user_cascades_across_every_collection(mock_db):
    from datetime import UTC, datetime, timedelta

    from bson import ObjectId

    from src.auth.commands.delete_user import DeleteUserCommand, DeleteUserHandler
    from src.auth.repository import (
        PasswordResetThrottleRepository,
        PasswordResetTokenRepository,
        RefreshTokenRepository,
    )
    from src.interpretations.repository import InterpretationWriteRepository
    from src.readings.repository import ReadingWriteRepository, UserTagsWriteRepository

    user_id = await _handler(mock_db).handle(_command("gone@example.com"))
    keeper_id = await _handler(mock_db).handle(_command("keeper@example.com"))
    expires = datetime.now(UTC) + timedelta(hours=1)
    for uid in (user_id, keeper_id):
        oid = ObjectId(uid)
        reading = await mock_db["readings"].insert_one({"user_id": oid, "cards": []})
        await mock_db["interpretations"].insert_one(
            {"user_id": oid, "reading_id": reading.inserted_id, "reading": "text"}
        )
        await mock_db["user_tags"].insert_one({"user_id": oid, "tags": []})
        await RefreshTokenRepository(mock_db).store(f"jti-{uid}", "family", uid, expires)
        await PasswordResetTokenRepository(mock_db).store(f"reset-{uid}", uid, expires)
        await EmailVerificationTokenRepository(mock_db).store(f"verify-{uid}", uid, expires)
    throttle = PasswordResetThrottleRepository(mock_db)
    for key in (
        "gone@example.com",
        "verify:gone@example.com",
        "login:203.0.113.9:gone@example.com",
        f"support:{user_id}",
        "keeper@example.com",
        "login:203.0.113.9:notgone@example.com",
    ):
        await throttle.record_attempt(key, expires_at=expires)

    handler = DeleteUserHandler(
        AuthReadRepository(mock_db),
        AuthWriteRepository(mock_db),
        RefreshTokenRepository(mock_db),
        PasswordResetTokenRepository(mock_db),
        EmailVerificationTokenRepository(mock_db),
        throttle,
        ReadingWriteRepository(mock_db),
        InterpretationWriteRepository(mock_db),
        UserTagsWriteRepository(mock_db),
    )
    await handler.handle(DeleteUserCommand(user_id=user_id))

    gone, kept = ObjectId(user_id), ObjectId(keeper_id)
    assert await mock_db["users"].find_one({"_id": gone}) is None
    assert await mock_db["users"].find_one({"_id": kept}) is not None
    for name in ("readings", "interpretations", "user_tags"):
        assert await mock_db[name].count_documents({"user_id": gone}) == 0, name
        assert await mock_db[name].count_documents({"user_id": kept}) == 1, name
    for name in ("refresh_tokens", "password_reset_tokens", "email_verification_tokens"):
        assert await mock_db[name].count_documents({"user_id": user_id}) == 0, name
        assert await mock_db[name].count_documents({"user_id": keeper_id}) == 1, name
    remaining = {doc["key"] async for doc in mock_db["password_reset_attempts"].find()}
    assert remaining == {"keeper@example.com", "login:203.0.113.9:notgone@example.com"}


async def test_delete_user_is_a_no_op_for_an_unknown_user(mock_db):
    from bson import ObjectId

    from src.auth.commands.delete_user import DeleteUserCommand, DeleteUserHandler
    from src.auth.repository import (
        PasswordResetThrottleRepository,
        PasswordResetTokenRepository,
        RefreshTokenRepository,
    )
    from src.interpretations.repository import InterpretationWriteRepository
    from src.readings.repository import ReadingWriteRepository, UserTagsWriteRepository

    keeper_id = await _handler(mock_db).handle(_command("keeper@example.com"))
    handler = DeleteUserHandler(
        AuthReadRepository(mock_db),
        AuthWriteRepository(mock_db),
        RefreshTokenRepository(mock_db),
        PasswordResetTokenRepository(mock_db),
        EmailVerificationTokenRepository(mock_db),
        PasswordResetThrottleRepository(mock_db),
        ReadingWriteRepository(mock_db),
        InterpretationWriteRepository(mock_db),
        UserTagsWriteRepository(mock_db),
    )

    await handler.handle(DeleteUserCommand(user_id=str(ObjectId())))

    assert await mock_db["users"].find_one({"_id": ObjectId(keeper_id)}) is not None
