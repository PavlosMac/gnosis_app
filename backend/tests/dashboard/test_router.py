from tests.factories import VALID_READING_BODY


async def test_get_dashboard_authenticated(client, auth_token):
    response = await client.get(
        "/api/v1/dashboard", headers={"Authorization": f"Bearer {auth_token}"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["user"]["email"] == "user@example.com"
    assert "_id" in data["user"]
    assert "password_hash" not in data["user"]
    assert data["last_reading"] is None
    assert data["total_readings"] == 0
    assert isinstance(data["remaining_budget_usd"], float)
    assert data["budget_usd"] == data["remaining_budget_usd"]
    assert data["user_tags"] == []


async def test_get_dashboard_unauthenticated(client):
    response = await client.get("/api/v1/dashboard")
    assert response.status_code == 401


async def test_get_dashboard_reflects_created_reading(client, auth_token):
    headers = {"Authorization": f"Bearer {auth_token}"}
    created = await client.post("/api/v1/readings", json=VALID_READING_BODY, headers=headers)
    assert created.status_code == 201

    response = await client.get("/api/v1/dashboard", headers=headers)

    data = response.json()
    assert data["total_readings"] == 1
    assert data["last_reading"]["_id"] == created.json()["_id"]
    assert data["last_reading"]["interpretation"] is None


async def test_get_dashboard_does_not_leak_other_users_readings(client, auth_token):
    other = await client.post(
        "/api/v1/auth/register",
        json={"email": "other@example.com", "password": "securepassword123"},
    )
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}
    assert (
        await client.post("/api/v1/readings", json=VALID_READING_BODY, headers=other_headers)
    ).status_code == 201

    response = await client.get(
        "/api/v1/dashboard", headers={"Authorization": f"Bearer {auth_token}"}
    )

    data = response.json()
    assert data["total_readings"] == 0
    assert data["last_reading"] is None


async def test_get_dashboard_carries_tag_vocabulary(client, auth_token):
    headers = {"Authorization": f"Bearer {auth_token}"}
    created = await client.post("/api/v1/readings", json=VALID_READING_BODY, headers=headers)
    patched = await client.patch(
        f"/api/v1/readings/{created.json()['_id']}/tags",
        json={"tags": "career, love"},
        headers=headers,
    )
    assert patched.status_code == 200, patched.text

    data = (await client.get("/api/v1/dashboard", headers=headers)).json()

    assert sorted(t["name"] for t in data["user_tags"]) == ["career", "love"]
    assert all(t["count"] == 1 for t in data["user_tags"])


async def test_get_dashboard_embeds_generated_interpretation(client, auth_token):
    headers = {"Authorization": f"Bearer {auth_token}"}
    created = await client.post("/api/v1/readings", json=VALID_READING_BODY, headers=headers)
    reading_id = created.json()["_id"]
    generated = await client.post(f"/api/v1/readings/{reading_id}/interpretation", headers=headers)
    assert generated.status_code == 200, generated.text

    data = (await client.get("/api/v1/dashboard", headers=headers)).json()

    assert data["last_reading"]["interpretation"]["reading_id"] == reading_id
    assert data["last_reading"]["interpretation"]["reading"]
    assert data["remaining_budget_usd"] == generated.json()["remaining_budget_usd"]
