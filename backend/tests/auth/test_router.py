import pytest


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
async def test_refresh_with_blacklisted_token_fails(client):
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "blacklist@example.com", "password": "securepassword123"},
    )
    refresh_token = reg.json()["refresh_token"]

    # First refresh succeeds and blacklists the old refresh token
    response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert response.status_code == 200

    # Second refresh with same token fails (blacklisted)
    response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_logout(client):
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "logout@example.com", "password": "securepassword123"},
    )
    access_token = reg.json()["access_token"]

    # Logout
    response = await client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == 200
    assert response.json()["detail"] == "Logged out"

    # Old access token should be rejected
    me_response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_response.status_code == 401


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
