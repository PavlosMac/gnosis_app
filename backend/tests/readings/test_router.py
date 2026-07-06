VALID_READING_BODY = {
    "spread_name": "Celtic Cross",
    "question": "What does the future hold?",
    "cards": [
        {"name": "The Fool", "position": "Present", "orientation": "upright"},
    ],
}


async def test_create_reading(client, auth_token):
    resp = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["spread_type"] == "Celtic Cross"
    assert data["question"] == "What does the future hold?"
    assert len(data["cards"]) == 1
    assert len(data["card_interpretations"]) == 1
    assert data["synthesis"] is not None
    assert data["model"] == "mock"
    assert data["_id"] is not None


async def test_create_reading_unauthenticated(client):
    resp = await client.post("/api/v1/readings", json=VALID_READING_BODY)
    assert resp.status_code == 401


async def test_list_readings_empty(client, auth_token):
    resp = await client.get(
        "/api/v1/readings",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0


async def test_list_readings_after_create(client, auth_token):
    await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    resp = await client.get(
        "/api/v1/readings",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    assert data["total"] == 1
    assert data["items"][0]["spread_type"] == "Celtic Cross"


async def test_get_reading_by_id(client, auth_token):
    create_resp = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    reading_id = create_resp.json()["_id"]
    resp = await client.get(
        f"/api/v1/readings/{reading_id}",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["_id"] == reading_id
    assert data["spread_type"] == "Celtic Cross"
    assert len(data["card_interpretations"]) == 1


async def test_get_reading_not_found(client, auth_token):
    resp = await client.get(
        "/api/v1/readings/507f1f77bcf86cd799439011",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 404


async def test_get_reading_wrong_user(client, auth_token):
    create_resp = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    reading_id = create_resp.json()["_id"]

    # Register a second user
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "other@example.com", "password": "securepassword123"},
    )
    other_token = reg.json()["access_token"]

    resp = await client.get(
        f"/api/v1/readings/{reading_id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 404


async def test_list_readings_pagination(client, auth_token):
    for _ in range(3):
        await client.post(
            "/api/v1/readings",
            json=VALID_READING_BODY,
            headers={"Authorization": f"Bearer {auth_token}"},
        )
    resp = await client.get(
        "/api/v1/readings?page=1&page_size=2",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    data = resp.json()
    assert len(data["items"]) == 2
    assert data["total"] == 3
    assert data["page"] == 1


async def test_update_reading_tags(client, auth_token):
    create_resp = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    reading_id = create_resp.json()["_id"]
    resp = await client.patch(
        f"/api/v1/readings/{reading_id}/tags",
        json={"tags": "Career, big decision"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["tags"] == ["career", "big decision"]
    assert data["_id"] == reading_id


async def test_update_reading_tags_too_many(client, auth_token):
    create_resp = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    reading_id = create_resp.json()["_id"]
    resp = await client.patch(
        f"/api/v1/readings/{reading_id}/tags",
        json={"tags": "a,b,c,d,e,f"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 422


async def test_update_reading_tags_too_long(client, auth_token):
    create_resp = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    reading_id = create_resp.json()["_id"]
    resp = await client.patch(
        f"/api/v1/readings/{reading_id}/tags",
        json={"tags": "a-tag-that-is-definitely-too-long"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 422


async def test_update_reading_tags_wrong_user(client, auth_token):
    create_resp = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    reading_id = create_resp.json()["_id"]

    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "other2@example.com", "password": "securepassword123"},
    )
    other_token = reg.json()["access_token"]

    resp = await client.patch(
        f"/api/v1/readings/{reading_id}/tags",
        json={"tags": "career"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 404
