"""GET /api/v1/users — superadmin listing."""

from tests.factories import invite, register_verify_and_login

USERS = "/api/v1/users"


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_list_users_unauthenticated(client):
    response = await client.get(USERS)
    assert response.status_code == 401


async def test_list_users_forbidden_for_regular_user(client, auth_token):
    response = await client.get(USERS, headers=_auth(auth_token))
    assert response.status_code == 403


async def test_list_users_as_superadmin(client, superadmin_token):
    response = await client.get(USERS, headers=_auth(superadmin_token))

    assert response.status_code == 200
    data = response.json()
    assert {"items", "total", "page", "page_size"} <= set(data)
    assert data["total"] >= 1
    assert data["page"] == 1


async def test_list_users_pagination_params(client, superadmin_token, mock_email):
    for i in range(3):
        await register_verify_and_login(client, mock_email, f"pag{i}@example.com")

    response = await client.get(f"{USERS}?page=1&page_size=2", headers=_auth(superadmin_token))

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 2
    assert data["page_size"] == 2
    assert data["total"] == 4  # 3 + superadmin


async def test_list_users_carries_id_and_status(client, superadmin_token):
    await invite(client, superadmin_token, "invitee@example.com")

    response = await client.get(USERS, headers=_auth(superadmin_token))

    by_email = {u["email"]: u for u in response.json()["items"]}
    assert by_email["invitee@example.com"]["status"] == "invited"
    assert by_email["admin@example.com"]["status"] == "active"
    # The frontend keys row actions on the id; it is serialised under the alias.
    assert len(by_email["admin@example.com"]["_id"]) == 24
