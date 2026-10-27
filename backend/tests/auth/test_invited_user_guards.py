"""An invited account has no password until the invite is accepted. Every path that
reads the hash must treat its absence as "wrong password", never as a 500."""

from datetime import UTC, datetime, timedelta

import pytest

from src.auth.models import User, UserStatus
from src.auth.repository import AuthReadRepository, RefreshTokenRepository, ThrottleRepository
from src.auth.service import AuthService, InvalidPasswordError
from src.core.config import settings

INVITED_EMAIL = "invitee@example.com"


def _invited_user() -> User:
    now = datetime.now(UTC)
    return User(
        email=INVITED_EMAIL,
        password_hash=None,
        status=UserStatus.INVITED,
        verification_deadline_at=now + timedelta(days=settings.invite_ttl_days),
        created_at=now,
        updated_at=now,
    )


@pytest.fixture
async def invited_user_id(mock_db) -> str:
    result = await mock_db["users"].insert_one(_invited_user().to_document())
    return str(result.inserted_id)


def test_invited_status_exists():
    assert UserStatus("invited") is UserStatus.INVITED


def test_password_hash_is_omitted_from_document_when_absent():
    doc = _invited_user().to_document()
    assert "password_hash" not in doc
    assert doc["status"] == "invited"


def test_from_document_tolerates_missing_password_hash():
    doc = _invited_user().to_document()
    doc["_id"] = "0" * 24
    assert User.from_document(doc).password_hash is None


async def test_login_as_invited_user_is_401_not_500(client, invited_user_id):
    response = await client.post(
        "/api/v1/auth/login", json={"email": INVITED_EMAIL, "password": "whatever-password-1"}
    )
    assert response.status_code == 401


async def test_confirm_password_for_invited_user_is_invalid_password(mock_db, invited_user_id):
    service = AuthService(
        AuthReadRepository(mock_db),
        RefreshTokenRepository(mock_db),
        ThrottleRepository(mock_db, key_prefix="login:"),
    )
    with pytest.raises(InvalidPasswordError):
        await service.confirm_password(invited_user_id, "whatever-password-1")


async def test_forgot_password_for_invited_user_sends_nothing(client, mock_email, invited_user_id):
    response = await client.post("/api/v1/auth/forgot-password", json={"email": INVITED_EMAIL})
    assert response.status_code == 200
    assert mock_email.sent_password_resets == []


async def test_verify_email_with_an_invite_token_leaves_the_account_invited(
    client, superadmin_token, mock_email, mock_db
):
    """Invite and sign-up tokens share a collection. Posting an invite token to the
    verification endpoint must neither activate the passwordless account nor burn the
    invite — the invitee can still accept it."""
    from tests.factories import invite, invite_token, make_accept_invite_body

    await invite(client, superadmin_token, INVITED_EMAIL)
    token = invite_token(mock_email)

    resp = await client.post("/api/v1/auth/verify-email", json={"token": token})

    assert resp.status_code == 400
    doc = await mock_db["users"].find_one({"email": INVITED_EMAIL})
    assert doc["status"] == "invited"
    assert "verification_deadline_at" in doc
    accept = await client.post("/api/v1/auth/accept-invite", json=make_accept_invite_body(token))
    assert accept.status_code == 200
