"""GET /api/v1/auth/invite and POST /api/v1/auth/accept-invite — the invitee's side."""

from datetime import UTC, datetime, timedelta

import pytest

from src.core.security import hash_token
from src.database.collections.constants import EMAIL_VERIFICATION_TOKENS_COLLECTION
from tests.factories import (
    DEFAULT_PASSWORD,
    invite,
    invite_token,
    make_accept_invite_body,
    make_register_body,
    verification_token,
)

LOOKUP = "/api/v1/auth/invite"
ACCEPT = "/api/v1/auth/accept-invite"
LOGIN = "/api/v1/auth/login"
EMAIL = "invitee@example.com"


async def _expire(mock_db, token: str) -> None:
    await mock_db[EMAIL_VERIFICATION_TOKENS_COLLECTION].update_one(
        {"token_hash": hash_token(token)},
        {"$set": {"expires_at": datetime.now(UTC) - timedelta(minutes=1)}},
    )


# --- lookup ---


async def test_lookup_returns_the_email_without_consuming_the_token(
    client, superadmin_token, mock_email, mock_db
):
    await invite(client, superadmin_token, EMAIL)
    token = invite_token(mock_email)

    resp = await client.get(LOOKUP, params={"token": token})

    assert resp.status_code == 200
    assert resp.json() == {"email": EMAIL}
    stored = await mock_db[EMAIL_VERIFICATION_TOKENS_COLLECTION].find_one(
        {"token_hash": hash_token(token)}
    )
    assert stored["used"] is False


async def test_lookup_unknown_token_is_400(client):
    resp = await client.get(LOOKUP, params={"token": "nope"})
    assert resp.status_code == 400


async def test_lookup_expired_token_is_410(client, superadmin_token, mock_email, mock_db):
    await invite(client, superadmin_token, EMAIL)
    token = invite_token(mock_email)
    await _expire(mock_db, token)

    resp = await client.get(LOOKUP, params={"token": token})

    assert resp.status_code == 410


async def test_lookup_rejects_a_verification_token_of_a_pending_user(client, mock_email):
    """Same collection, different purpose: a sign-up confirmation link must not open
    the invite form."""
    reg = await client.post("/api/v1/auth/register", json=make_register_body(email=EMAIL))
    assert reg.status_code == 201

    resp = await client.get(LOOKUP, params={"token": verification_token(mock_email)})

    assert resp.status_code == 400


# --- accept ---


async def test_accept_activates_the_account_and_login_works(
    client, superadmin_token, mock_email, mock_db
):
    await invite(client, superadmin_token, EMAIL)
    token = invite_token(mock_email)

    resp = await client.post(ACCEPT, json=make_accept_invite_body(token))

    assert resp.status_code == 200
    assert "access_token" not in resp.json()

    doc = await mock_db["users"].find_one({"email": EMAIL})
    assert doc["status"] == "active"
    assert doc["first_name"] == "Invited"
    assert doc["last_name"] == "Seeker"
    assert doc["display_name"] == "Invited Seeker"
    assert doc["consents"]["terms"]["version"] == "2026-10-04"
    assert doc["consents"]["privacy"]["version"] == "2026-10-13"
    assert doc["email_verified_at"] is not None
    assert "verification_deadline_at" not in doc

    login = await client.post(LOGIN, json={"email": EMAIL, "password": DEFAULT_PASSWORD})
    assert login.status_code == 200
    me = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"}
    )
    assert me.json()["status"] == "active"
    assert set(me.json()["consents"]) == {"terms", "privacy"}


async def test_accept_consumes_the_token(client, superadmin_token, mock_email):
    await invite(client, superadmin_token, EMAIL)
    token = invite_token(mock_email)
    assert (await client.post(ACCEPT, json=make_accept_invite_body(token))).status_code == 200

    again = await client.post(ACCEPT, json=make_accept_invite_body(token))
    lookup = await client.get(LOOKUP, params={"token": token})

    assert again.status_code == 400
    assert lookup.status_code == 400


async def test_accept_unknown_token_is_400(client):
    resp = await client.post(ACCEPT, json=make_accept_invite_body("nope"))
    assert resp.status_code == 400


async def test_accept_expired_token_is_410(client, superadmin_token, mock_email, mock_db):
    await invite(client, superadmin_token, EMAIL)
    token = invite_token(mock_email)
    await _expire(mock_db, token)

    resp = await client.post(ACCEPT, json=make_accept_invite_body(token))

    assert resp.status_code == 410


async def test_accept_with_a_weak_password_is_422_and_keeps_the_link_usable(
    client, superadmin_token, mock_email
):
    await invite(client, superadmin_token, EMAIL)
    token = invite_token(mock_email)

    weak = await client.post(ACCEPT, json=make_accept_invite_body(token, password="password1234"))
    assert weak.status_code == 422
    assert weak.json()["code"] == "weak_password"

    retry = await client.post(ACCEPT, json=make_accept_invite_body(token))
    assert retry.status_code == 200


async def test_accept_rejects_a_verification_token_of_a_pending_user(client, mock_email, mock_db):
    reg = await client.post("/api/v1/auth/register", json=make_register_body(email=EMAIL))
    assert reg.status_code == 201
    token = verification_token(mock_email)

    resp = await client.post(ACCEPT, json=make_accept_invite_body(token))

    assert resp.status_code == 400
    doc = await mock_db["users"].find_one({"email": EMAIL})
    assert doc["status"] == "pending_verification"
    assert doc["first_name"] == "Test"


async def test_accept_that_fails_to_activate_does_not_burn_the_link(
    client, superadmin_token, mock_email, mock_db, monkeypatch
):
    """The token is only retired once the account is active, so an infrastructure
    error during activation leaves the invitee with a working link."""
    from src.auth.repository import AuthWriteRepository

    await invite(client, superadmin_token, EMAIL)
    token = invite_token(mock_email)

    async def boom(self, *args, **kwargs):
        raise RuntimeError("mongo blip")

    with monkeypatch.context() as m:
        m.setattr(AuthWriteRepository, "activate_invited", boom)
        with pytest.raises(RuntimeError):
            await client.post(ACCEPT, json=make_accept_invite_body(token))

    retry = await client.post(ACCEPT, json=make_accept_invite_body(token))
    assert retry.status_code == 200


async def test_accept_deletes_the_users_tokens_on_success(
    client, superadmin_token, mock_email, mock_db
):
    await invite(client, superadmin_token, EMAIL)
    token = invite_token(mock_email)
    await client.post(ACCEPT, json=make_accept_invite_body(token))
    assert await mock_db[EMAIL_VERIFICATION_TOKENS_COLLECTION].count_documents({}) == 0


async def test_lookup_is_rate_limited_per_client_ip(client):
    from src.core.config import settings

    for _ in range(settings.login_rate_limit_max_attempts):
        assert (await client.get(LOOKUP, params={"token": "nope"})).status_code == 400

    resp = await client.get(LOOKUP, params={"token": "nope"})

    assert resp.status_code == 429


async def test_accept_is_rate_limited_per_client_ip(client):
    from src.core.config import settings

    for _ in range(settings.login_rate_limit_max_attempts):
        assert (await client.post(ACCEPT, json=make_accept_invite_body("nope"))).status_code == 400

    resp = await client.post(ACCEPT, json=make_accept_invite_body("nope"))

    assert resp.status_code == 429


async def test_invite_throttle_is_keyed_by_ip(client):
    from src.core.config import settings

    for _ in range(settings.login_rate_limit_max_attempts + 1):
        await client.get(
            LOOKUP, params={"token": "nope"}, headers={"X-Forwarded-For": "198.51.100.1"}
        )

    other = await client.get(
        LOOKUP, params={"token": "nope"}, headers={"X-Forwarded-For": "198.51.100.2"}
    )

    assert other.status_code == 400
