from tests.factories import VALID_READING_BODY

TRADITIONAL = {"lens": "traditional", "intent": "reflective", "depth": 60}
ESOTERIC = {"lens": "esoteric", "intent": "predictive", "depth": 40}


async def _create_reading(client, auth_token) -> str:
    resp = await client.post(
        "/api/v1/readings",
        json=VALID_READING_BODY,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 201, f"Reading creation failed: {resp.text}"
    return resp.json()["_id"]


async def _generate(client, auth_token, reading_id: str, settings: dict = TRADITIONAL) -> dict:
    resp = await client.post(
        f"/api/v1/readings/{reading_id}/interpretation/generate",
        json={"settings": settings},
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


async def _save(client, auth_token, reading_id: str, body: dict):
    return await client.put(
        f"/api/v1/readings/{reading_id}/interpretations/{body['settings']['lens']}",
        json=body,
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
    data = await _generate(client, auth_token, reading_id)
    assert len(data["card_interpretations"]) == 1
    assert data["synthesis"] is not None
    assert data["settings"] == TRADITIONAL


async def test_generate_interpretation_does_not_persist(client, auth_token):
    reading_id = await _create_reading(client, auth_token)
    await _generate(client, auth_token, reading_id)
    reading = await _get_reading(client, auth_token, reading_id)
    assert reading["interpretations"] == []


async def test_generate_interpretation_requires_settings(client, auth_token):
    reading_id = await _create_reading(client, auth_token)
    resp = await client.post(
        f"/api/v1/readings/{reading_id}/interpretation/generate",
        json={},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 422


async def test_generate_interpretation_not_found(client, auth_token):
    resp = await client.post(
        "/api/v1/readings/507f1f77bcf86cd799439011/interpretation/generate",
        json={"settings": TRADITIONAL},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 404


async def test_generate_interpretation_unauthenticated(client):
    resp = await client.post(
        "/api/v1/readings/507f1f77bcf86cd799439011/interpretation/generate",
        json={"settings": TRADITIONAL},
    )
    assert resp.status_code == 401


async def test_generate_interpretation_rejects_unknown_lens(client, auth_token):
    reading_id = await _create_reading(client, auth_token)
    resp = await client.post(
        f"/api/v1/readings/{reading_id}/interpretation/generate",
        json={"settings": {**TRADITIONAL, "lens": "spiritual"}},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 422


async def test_generate_interpretation_rejects_out_of_range_depth(client, auth_token):
    reading_id = await _create_reading(client, auth_token)
    resp = await client.post(
        f"/api/v1/readings/{reading_id}/interpretation/generate",
        json={"settings": {**TRADITIONAL, "depth": 150}},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 422


async def test_save_interpretation(client, auth_token):
    reading_id = await _create_reading(client, auth_token)
    generated = await _generate(client, auth_token, reading_id)

    resp = await _save(client, auth_token, reading_id, _save_body(generated))
    assert resp.status_code == 200
    saved = resp.json()["interpretations"]
    assert len(saved) == 1
    assert saved[0]["reading_id"] == reading_id
    assert saved[0]["settings"] == TRADITIONAL

    reading = await _get_reading(client, auth_token, reading_id)
    assert reading["interpretations"][0]["synthesis"] == generated["synthesis"]


async def test_save_replaces_the_same_lens(client, auth_token):
    reading_id = await _create_reading(client, auth_token)
    generated = await _generate(client, auth_token, reading_id)
    body = _save_body(generated)

    first = await _save(client, auth_token, reading_id, body)
    second = await _save(
        client, auth_token, reading_id, {**body, "synthesis": "A revised synthesis."}
    )
    assert second.status_code == 200
    assert len(second.json()["interpretations"]) == 1
    assert second.json()["interpretations"][0]["_id"] == first.json()["interpretations"][0]["_id"]
    assert second.json()["interpretations"][0]["synthesis"] == "A revised synthesis."


async def test_each_lens_is_its_own_slot(client, auth_token):
    reading_id = await _create_reading(client, auth_token)

    traditional = await _generate(client, auth_token, reading_id, TRADITIONAL)
    await _save(client, auth_token, reading_id, _save_body(traditional))
    esoteric = await _generate(client, auth_token, reading_id, ESOTERIC)
    resp = await _save(client, auth_token, reading_id, _save_body(esoteric))

    assert resp.status_code == 200
    lenses = [i["settings"]["lens"] for i in resp.json()["interpretations"]]
    assert sorted(lenses) == ["esoteric", "traditional"]

    reading = await _get_reading(client, auth_token, reading_id)
    assert len(reading["interpretations"]) == 2


async def test_save_rejects_lens_mismatch_between_path_and_body(client, auth_token):
    reading_id = await _create_reading(client, auth_token)
    generated = await _generate(client, auth_token, reading_id)

    resp = await client.put(
        f"/api/v1/readings/{reading_id}/interpretations/esoteric",
        json=_save_body(generated),  # settings.lens is traditional
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 422
    assert "does not match" in resp.json()["detail"]


async def test_save_interpretation_wrong_user(client, auth_token):
    reading_id = await _create_reading(client, auth_token)
    generated = await _generate(client, auth_token, reading_id)

    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "otherinterp@example.com", "password": "securepassword123"},
    )
    other_token = reg.json()["access_token"]

    resp = await _save(client, other_token, reading_id, _save_body(generated))
    assert resp.status_code == 404
