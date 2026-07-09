VALID_READING_BODY = {
    "spread_name": "Celtic Cross",
    "question": "What does the future hold?",
    "cards": [
        {"name": "The Fool", "position": "Present", "orientation": "upright"},
    ],
}

DEFAULT_SETTINGS_WIRE = {"style": "reflective", "depth": 60, "tone": 50}


async def _create_reading(client, auth_token) -> str:
    resp = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 201, f"Reading creation failed: {resp.text}"
    return resp.json()["_id"]


async def _generate(client, auth_token, reading_id: str) -> dict:
    resp = await client.post(
        f"/api/v1/readings/{reading_id}/interpretation/generate",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200, f"Generate failed: {resp.text}"
    return resp.json()


def _save_body(generated: dict) -> dict:
    return {
        "card_interpretations": generated["card_interpretations"],
        "synthesis": generated["synthesis"],
        "model": generated["model"],
        "tokens_used": generated["tokens_used"],
        "settings": generated["settings"],
    }


async def test_generate_interpretation(client, auth_token):
    reading_id = await _create_reading(client, auth_token)
    data = await _generate(client, auth_token, reading_id)
    assert len(data["card_interpretations"]) == 1
    assert data["synthesis"] is not None
    assert data["settings"] == DEFAULT_SETTINGS_WIRE


async def test_generate_interpretation_does_not_persist(client, auth_token):
    reading_id = await _create_reading(client, auth_token)
    await _generate(client, auth_token, reading_id)

    resp = await client.get(
        f"/api/v1/readings/{reading_id}",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.json()["interpretation"] is None


async def test_generate_interpretation_not_found(client, auth_token):
    resp = await client.post(
        "/api/v1/readings/507f1f77bcf86cd799439011/interpretation/generate",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 404


async def test_generate_interpretation_unauthenticated(client):
    resp = await client.post(
        "/api/v1/readings/507f1f77bcf86cd799439011/interpretation/generate"
    )
    assert resp.status_code == 401


async def test_save_interpretation(client, auth_token):
    reading_id = await _create_reading(client, auth_token)
    generated = await _generate(client, auth_token, reading_id)

    resp = await client.post(
        f"/api/v1/readings/{reading_id}/interpretation",
        json=_save_body(generated),
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["reading_id"] == reading_id
    assert data["synthesis"] == generated["synthesis"]
    assert data["settings"] == DEFAULT_SETTINGS_WIRE

    get_resp = await client.get(
        f"/api/v1/readings/{reading_id}",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert get_resp.json()["interpretation"]["synthesis"] == generated["synthesis"]


async def test_save_interpretation_overwrites_previous(client, auth_token):
    reading_id = await _create_reading(client, auth_token)
    generated = await _generate(client, auth_token, reading_id)
    body = _save_body(generated)

    first = await client.post(
        f"/api/v1/readings/{reading_id}/interpretation",
        json=body,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    second = await client.post(
        f"/api/v1/readings/{reading_id}/interpretation",
        json={**body, "synthesis": "A revised synthesis."},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert second.json()["_id"] == first.json()["_id"]
    assert second.json()["synthesis"] == "A revised synthesis."


async def test_save_interpretation_wrong_user(client, auth_token):
    reading_id = await _create_reading(client, auth_token)
    generated = await _generate(client, auth_token, reading_id)

    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "otherinterp@example.com", "password": "securepassword123"},
    )
    other_token = reg.json()["access_token"]

    resp = await client.post(
        f"/api/v1/readings/{reading_id}/interpretation",
        json=_save_body(generated),
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 404
