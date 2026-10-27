from datetime import UTC, datetime, timedelta

import jwt as pyjwt
import pytest

from src.core.config import settings
from tests.factories import make_register_body, register_verify_and_login, verification_token


@pytest.mark.asyncio
async def test_register(client):
    response = await client.post(
        "/api/v1/auth/register", json=make_register_body(email="test@example.com")
    )
    assert response.status_code == 201
    data = response.json()
    # Hard verification gate: registering never yields a session
    assert "access_token" not in data
    assert "refresh_token" not in data
    assert "detail" in data


@pytest.mark.asyncio
async def test_register_duplicate_email(client):
    payload = make_register_body(email="dup@example.com")
    await client.post("/api/v1/auth/register", json=payload)
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_login(client, mock_email):
    await register_verify_and_login(client, mock_email, "login@example.com")
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "login@example.com", "password": "securepassword123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_login_invalid_credentials(client):
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_me(client, mock_email):
    reg = await register_verify_and_login(client, mock_email, "me@example.com")
    token = reg["access_token"]

    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "me@example.com"
    assert "credits" in data
    assert "_id" in data


async def test_get_me_superadmin_returns_flag(client, superadmin_token):
    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {superadmin_token}"},
    )
    assert response.status_code == 200
    assert response.json()["is_superadmin"] is True


@pytest.mark.asyncio
async def test_get_me_unauthenticated(client):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh_tokens(client, mock_email):
    reg = await register_verify_and_login(client, mock_email, "refresh@example.com")
    refresh_token = reg["refresh_token"]

    response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data

    # Verify new access token works
    me_response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {data['access_token']}"},
    )
    assert me_response.status_code == 200


@pytest.mark.asyncio
async def test_refresh_with_access_token_fails(client, mock_email):
    reg = await register_verify_and_login(client, mock_email, "accessrefresh@example.com")
    access_token = reg["access_token"]

    response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": access_token},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh_reuse_revokes_family(client, mock_email):
    reg = await register_verify_and_login(client, mock_email, "rotation@example.com")
    old_refresh = reg["refresh_token"]

    # First refresh succeeds and rotates the token
    response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh},
    )
    assert response.status_code == 200

    # Reuse of old refresh token fails (replay detection)
    response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh_replay_revokes_entire_family(client, mock_email, monkeypatch):
    monkeypatch.setattr("src.auth.service.REFRESH_REPLAY_GRACE_SECONDS", -1)
    reg = await register_verify_and_login(client, mock_email, "replay@example.com")
    old_refresh = reg["refresh_token"]

    # First refresh: rotates token, get new tokens
    first = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh},
    )
    assert first.status_code == 200
    new_refresh = first.json()["refresh_token"]

    # Replay old token: triggers family revocation
    replay = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh},
    )
    assert replay.status_code == 401

    # Even the new refresh token is now revoked (entire family wiped)
    response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": new_refresh},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_logout(client, mock_email):
    reg = await register_verify_and_login(client, mock_email, "logout@example.com")
    tokens = reg
    access_token = tokens["access_token"]
    refresh_token = tokens["refresh_token"]

    # Logout
    response = await client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == 200
    assert response.json()["detail"] == "Logged out"

    # The access token dies with its session
    me_response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_response.status_code == 401

    # And the refresh token family is revoked — can't get new tokens
    refresh_response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_response.status_code == 401


@pytest.mark.asyncio
async def test_logout_unauthenticated(client):
    response = await client.post("/api/v1/auth/logout")
    assert response.status_code == 401


# --- Token expiry tests ---


def _make_expired_token(payload_overrides: dict) -> str:
    payload = {
        "exp": datetime.now(UTC) - timedelta(seconds=10),
        **payload_overrides,
    }
    return pyjwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


@pytest.mark.asyncio
async def test_expired_access_token_returns_401(client):
    expired = _make_expired_token({"sub": "any-id", "type": "access", "family_id": "any-family"})
    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired}"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_expired_refresh_token_returns_401(client):
    expired = _make_expired_token(
        {"sub": "any-id", "type": "refresh", "jti": "any-jti", "family_id": "any-family"}
    )
    response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": expired},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_expired_access_then_refresh_rotation_flow(client, mock_email):
    """Expired access → 401 → refresh → new tokens → retry succeeds."""
    reg = await register_verify_and_login(client, mock_email, "rotation_flow@example.com")
    tokens = reg
    refresh_token = tokens["refresh_token"]

    # Extract user_id + family_id from the valid access token
    payload = pyjwt.decode(
        tokens["access_token"], settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
    )

    # Craft an expired access token for the same user
    expired_access = _make_expired_token(
        {"sub": payload["sub"], "type": "access", "family_id": payload["family_id"]}
    )

    # Step 1: expired access token → 401
    assert (
        await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_access}"})
    ).status_code == 401

    # Step 2: refresh → new tokens
    refresh_resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_resp.status_code == 200
    new_tokens = refresh_resp.json()
    assert "access_token" in new_tokens
    assert "refresh_token" in new_tokens

    # Step 3: retry with new access token → 200
    me_resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {new_tokens['access_token']}"},
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "rotation_flow@example.com"


# --- Email normalisation, names and consents ---


async def test_register_normalises_email_and_login_is_case_insensitive(client, mock_db, mock_email):
    await register_verify_and_login(client, mock_email, "MixedCase@Example.com")
    assert await mock_db["users"].find_one({"email": "mixedcase@example.com"}) is not None

    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "MIXEDCASE@example.COM", "password": "securepassword123"},
    )
    assert login.status_code == 200


async def test_register_duplicate_email_differing_only_in_case(client):
    await client.post("/api/v1/auth/register", json=make_register_body(email="dupcase@example.com"))
    response = await client.post(
        "/api/v1/auth/register", json=make_register_body(email="DupCase@Example.com")
    )
    assert response.status_code == 409


async def test_get_me_returns_empty_consents_for_a_legacy_document(client, mock_db):
    from src.core.security import hash_password

    now = datetime.now(UTC)
    await mock_db["users"].insert_one(
        {
            "email": "legacy@example.com",
            "password_hash": hash_password("securepassword123"),
            "created_at": now,
            "updated_at": now,
        }
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "legacy@example.com", "password": "securepassword123"},
    )
    token = login.json()["access_token"]

    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert me.status_code == 200
    data = me.json()
    assert data["consents"] == {}
    assert data["first_name"] is None
    assert data["last_name"] is None


async def test_register_with_names_and_consents_shows_on_me(client, mock_email):
    reg = await client.post(
        "/api/v1/auth/register",
        json=make_register_body(
            email="named@example.com",
            first_name="Ada",
            last_name="Lovelace",
            terms="2026-09-30",
            privacy="2026-09-30",
        ),
    )
    assert reg.status_code == 201
    await client.post("/api/v1/auth/verify-email", json={"token": verification_token(mock_email)})
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "named@example.com", "password": "securepassword123"},
    )
    token = login.json()["access_token"]

    data = (
        await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    ).json()

    assert data["first_name"] == "Ada"
    assert data["last_name"] == "Lovelace"
    assert data["display_name"] == "Ada Lovelace"
    assert data["consents"]["terms"]["version"] == "2026-09-30"
    assert "accepted_at" in data["consents"]["privacy"]
