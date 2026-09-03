from src.core.config import settings as app_settings
from tests.factories import VALID_READING_BODY


async def _create_reading(client, auth_token) -> str:
    resp = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 201, f"Reading creation failed: {resp.text}"
    return resp.json()["_id"]


async def _generate(client, auth_token, reading_id: str):
    """One step, no body: generates, persists, and returns the interpretation."""
    return await client.post(
        f"/api/v1/readings/{reading_id}/interpretation",
        headers={"Authorization": f"Bearer {auth_token}"},
    )


async def _get_reading(client, auth_token, reading_id: str) -> dict:
    resp = await client.get(
        f"/api/v1/readings/{reading_id}",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    return resp.json()


async def test_generate_interpretation(client, auth_token):
    reading_id = await _create_reading(client, auth_token)
    resp = await _generate(client, auth_token, reading_id)
    assert resp.status_code == 200, f"Generate failed: {resp.text}"
    data = resp.json()
    assert "The Fool" in data["interpretation"]["reading"]
    assert data["interpretation"]["reading_id"] == reading_id
    assert data["interpretation"]["usage"]["cost_usd"] == 0.0
    assert "settings" not in data["interpretation"]
    assert data["remaining_budget_usd"] == app_settings.user_budget_usd


async def test_generate_persists_immediately(client, auth_token):
    """No preview step: the interpretation the response carries is already stored."""
    reading_id = await _create_reading(client, auth_token)
    generated = (await _generate(client, auth_token, reading_id)).json()

    reading = await _get_reading(client, auth_token, reading_id)
    assert reading["interpretation"]["reading"] == generated["interpretation"]["reading"]
    assert reading["interpretation"]["_id"] == generated["interpretation"]["_id"]


async def test_reading_carries_null_interpretation_before_generate(client, auth_token):
    reading_id = await _create_reading(client, auth_token)
    reading = await _get_reading(client, auth_token, reading_id)
    assert reading["interpretation"] is None


async def test_second_generate_returns_the_stored_interpretation(client, auth_token):
    """Idempotent: the reading's one interpretation is generated once — a repeat call
    hands back the same stored document, free."""
    reading_id = await _create_reading(client, auth_token)
    first = (await _generate(client, auth_token, reading_id)).json()

    resp = await _generate(client, auth_token, reading_id)
    assert resp.status_code == 200
    second = resp.json()
    assert second["interpretation"]["_id"] == first["interpretation"]["_id"]
    assert second["interpretation"]["reading"] == first["interpretation"]["reading"]
    assert second["remaining_budget_usd"] == first["remaining_budget_usd"]

    reading = await _get_reading(client, auth_token, reading_id)
    assert reading["interpretation"]["_id"] == first["interpretation"]["_id"]


async def test_generate_interpretation_not_found(client, auth_token):
    resp = await _generate(client, auth_token, "507f1f77bcf86cd799439011")
    assert resp.status_code == 404


async def test_generate_interpretation_unauthenticated(client):
    resp = await client.post("/api/v1/readings/507f1f77bcf86cd799439011/interpretation")
    assert resp.status_code == 401


async def test_generate_interpretation_wrong_user(client, auth_token):
    """An existing interpretation on someone else's reading still 404s — ownership is
    checked before the idempotent return."""
    reading_id = await _create_reading(client, auth_token)
    await _generate(client, auth_token, reading_id)

    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "otherinterp@example.com", "password": "securepassword123"},
    )
    other_token = reg.json()["access_token"]

    resp = await _generate(client, other_token, reading_id)
    assert resp.status_code == 404


async def test_generate_returns_402_when_budget_exhausted(client, auth_token, mock_db):
    reading_id = await _create_reading(client, auth_token)
    await mock_db["users"].update_one(
        {"email": "user@example.com"},
        {"$set": {"usage": {"cost_usd": app_settings.user_budget_usd}}},
    )

    resp = await _generate(client, auth_token, reading_id)
    assert resp.status_code == 402
    assert resp.json() == {"detail": "Usage budget exhausted"}


async def test_the_old_two_step_routes_are_gone(client, auth_token):
    """The preview/save split no longer exists: /generate 404s and the PUT is gone."""
    reading_id = await _create_reading(client, auth_token)
    headers = {"Authorization": f"Bearer {auth_token}"}

    old_generate = await client.post(
        f"/api/v1/readings/{reading_id}/interpretation/generate", headers=headers
    )
    assert old_generate.status_code in (404, 405)

    old_save = await client.put(
        f"/api/v1/readings/{reading_id}/interpretation", json={}, headers=headers
    )
    assert old_save.status_code == 405
