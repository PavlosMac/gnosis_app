from datetime import UTC, datetime, timedelta

import jwt as pyjwt
import pytest

from src.core.config import settings


@pytest.mark.asyncio
async def test_register(client):
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "test@example.com",
            "password": "securepassword123",
            "display_name": "Test User",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_duplicate_email(client):
    payload = {"email": "dup@example.com", "password": "securepassword123"}
    await client.post("/api/v1/auth/register", json=payload)
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_login(client):
    await client.post(
        "/api/v1/auth/register",
        json={"email": "login@example.com", "password": "securepassword123"},
    )
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
async def test_get_me(client):
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "me@example.com", "password": "securepassword123"},
    )
    token = reg.json()["access_token"]

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
async def test_refresh_tokens(client):
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "refresh@example.com", "password": "securepassword123"},
    )
    refresh_token = reg.json()["refresh_token"]

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
async def test_refresh_with_access_token_fails(client):
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "accessrefresh@example.com", "password": "securepassword123"},
    )
    access_token = reg.json()["access_token"]

    response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": access_token},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh_reuse_revokes_family(client):
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "rotation@example.com", "password": "securepassword123"},
    )
    old_refresh = reg.json()["refresh_token"]

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
async def test_refresh_replay_revokes_entire_family(client):
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "replay@example.com", "password": "securepassword123"},
    )
    old_refresh = reg.json()["refresh_token"]

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
async def test_logout(client):
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "logout@example.com", "password": "securepassword123"},
    )
    tokens = reg.json()
    access_token = tokens["access_token"]
    refresh_token = tokens["refresh_token"]

    # Logout
    response = await client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == 200
    assert response.json()["detail"] == "Logged out"

    # Access token still works (no blacklist check, valid until expiry)
    me_response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_response.status_code == 200

    # But refresh token family is revoked — can't get new tokens
    refresh_response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_response.status_code == 401


@pytest.mark.asyncio
async def test_logout_unauthenticated(client):
    response = await client.post("/api/v1/auth/logout")
    assert response.status_code == 401


# --- GET /api/v1/users (superadmin) ---


async def test_list_users_unauthenticated(client):
    response = await client.get("/api/v1/users")
    assert response.status_code == 401


async def test_list_users_forbidden_for_regular_user(client):
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "regular@example.com", "password": "securepassword123"},
    )
    token = reg.json()["access_token"]
    response = await client.get(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


async def test_list_users_as_superadmin(client, superadmin_token):
    response = await client.get(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {superadmin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data
    assert data["total"] >= 1
    assert data["page"] == 1


async def test_list_users_pagination_params(client, superadmin_token):
    # Register additional users
    for i in range(3):
        await client.post(
            "/api/v1/auth/register",
            json={"email": f"pag{i}@example.com", "password": "securepassword123"},
        )

    response = await client.get(
        "/api/v1/users?page=1&page_size=2",
        headers={"Authorization": f"Bearer {superadmin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 2
    assert data["page_size"] == 2
    assert data["total"] == 4  # 3 + superadmin


# --- Token expiry tests ---


def _make_expired_token(payload_overrides: dict) -> str:
    payload = {
        "exp": datetime.now(UTC) - timedelta(seconds=10),
        **payload_overrides,
    }
    return pyjwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


@pytest.mark.asyncio
async def test_expired_access_token_returns_401(client):
    expired = _make_expired_token(
        {"sub": "any-id", "type": "access", "family_id": "any-family"}
    )
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
async def test_expired_access_then_refresh_rotation_flow(client):
    """Expired access → 401 → refresh → new tokens → retry succeeds."""
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "rotation_flow@example.com", "password": "securepassword123"},
    )
    tokens = reg.json()
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
        await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_access}"}
        )
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
