from datetime import UTC, datetime

from bson import ObjectId

from src.database.collections.constants import READINGS_COLLECTION
from tests.factories import VALID_READING_BODY


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
    assert data["interpretation"] is None
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
    assert data["user_tags"] == []


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
    assert data["interpretation"] is None


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


async def test_list_readings_sort_by_date(client, auth_token, mock_db):
    headers = {"Authorization": f"Bearer {auth_token}"}
    # Pin the dates: readings posted back to back can share a created_at
    for day, spread in enumerate(("First", "Second", "Third"), start=1):
        created = await client.post(
            "/api/v1/readings",
            json={**VALID_READING_BODY, "spread_name": spread},
            headers=headers,
        )
        await mock_db[READINGS_COLLECTION].update_one(
            {"_id": ObjectId(created.json()["_id"])},
            {"$set": {"created_at": datetime(2026, 1, day, tzinfo=UTC)}},
        )

    newest = await client.get("/api/v1/readings?sort=created_at", headers=headers)
    oldest = await client.get("/api/v1/readings?sort=created_at&order=asc", headers=headers)
    # order without sort is a no-op: the default stays newest first
    order_only = await client.get("/api/v1/readings?order=asc", headers=headers)

    assert newest.status_code == 200
    assert oldest.status_code == 200
    assert order_only.status_code == 200
    assert [item["spread_type"] for item in order_only.json()["items"]] == [
        "Third",
        "Second",
        "First",
    ]
    assert [item["spread_type"] for item in newest.json()["items"]] == [
        "Third",
        "Second",
        "First",
    ]
    assert [item["spread_type"] for item in oldest.json()["items"]] == [
        "First",
        "Second",
        "Third",
    ]


async def test_list_readings_bounds_the_query_params(client, auth_token):
    """Every list param comes off the URL: oversized values get a 422, never a 500
    from an overflowing skip or an unbounded $in filter."""
    headers = {"Authorization": f"Bearer {auth_token}"}
    ok = await client.get("/api/v1/readings?page=10000", headers=headers)
    assert ok.status_code == 200

    for query in (
        "page=10001",
        "page=99999999999999999999",
        f"spread_type={'x' * 101}",
        f"tags={'a' * 521}",
    ):
        resp = await client.get(f"/api/v1/readings?{query}", headers=headers)
        assert resp.status_code == 422, query


async def test_list_readings_treats_operator_shaped_values_as_plain_strings(client, auth_token):
    """Query params are always strings, so a Mongo operator in a filter value can
    only ever be a literal that matches nothing."""
    await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    resp = await client.get(
        '/api/v1/readings?spread_type={"$ne":"x"}&tags=$where',
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


async def test_list_readings_rejects_unknown_sort_field(client, auth_token):
    """The sort field is a whitelist — arbitrary field names never reach Mongo."""
    resp = await client.get(
        "/api/v1/readings?sort=password_hash",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 422


async def test_list_readings_rejects_unknown_order(client, auth_token):
    resp = await client.get(
        "/api/v1/readings?sort=created_at&order=sideways",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 422


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


async def test_list_readings_filters_by_tags(client, auth_token, mock_db):
    one_match = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    two_match = await client.post(
        "/api/v1/readings",
        json={**VALID_READING_BODY, "spread_name": "Two Match"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    # Pin the dates: posted back to back they can share a created_at, and the order
    # assertion below is a date order
    for day, created in enumerate((one_match, two_match), start=1):
        await mock_db[READINGS_COLLECTION].update_one(
            {"_id": ObjectId(created.json()["_id"])},
            {"$set": {"created_at": datetime(2026, 1, day, tzinfo=UTC)}},
        )

    await client.patch(
        f"/api/v1/readings/{one_match.json()['_id']}/tags",
        json={"tags": "career"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    await client.patch(
        f"/api/v1/readings/{two_match.json()['_id']}/tags",
        json={"tags": "career, love"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )

    resp = await client.get(
        "/api/v1/readings?tags=career,love",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    data = resp.json()
    # Both match; newest first, regardless of how many tags each matched
    assert [item["spread_type"] for item in data["items"]] == ["Two Match", "Celtic Cross"]


async def test_list_readings_returns_user_tags(client, auth_token):
    first = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    second = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    await client.patch(
        f"/api/v1/readings/{first.json()['_id']}/tags",
        json={"tags": "Career, love"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    await client.patch(
        f"/api/v1/readings/{second.json()['_id']}/tags",
        json={"tags": "career"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )

    resp = await client.get(
        "/api/v1/readings?tags=luck&page_size=1",
        headers={"Authorization": f"Bearer {auth_token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["user_tags"] == [
        {"name": "career", "count": 2},
        {"name": "love", "count": 1},
    ]


async def test_update_reading_tags_unauthenticated(client):
    resp = await client.patch(
        "/api/v1/readings/507f1f77bcf86cd799439011/tags",
        json={"tags": "career"},
    )
    assert resp.status_code == 401


async def test_update_reading_tags_rejects_non_string(client, auth_token):
    create_resp = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    reading_id = create_resp.json()["_id"]
    resp = await client.patch(
        f"/api/v1/readings/{reading_id}/tags",
        json={"tags": ["career", "love"]},
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


async def test_create_reading_without_position(client, auth_token):
    body = {
        "spread_name": "Three Card Relationship",
        "cards": [{"name": "The Fool", "orientation": "upright"}],
    }
    resp = await client.post(
        "/api/v1/readings",
        json=body,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 201
    assert resp.json()["cards"][0]["position"] is None
