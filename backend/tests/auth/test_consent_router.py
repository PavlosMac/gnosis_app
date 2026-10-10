async def _me(client, token: str) -> dict:
    resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    return resp.json()


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def test_consent_requires_authentication(client):
    resp = await client.post("/api/v1/auth/consent", json={"terms": "2026-09-30"})
    assert resp.status_code == 401


async def test_consent_empty_body_is_rejected(client, auth_token):
    resp = await client.post("/api/v1/auth/consent", json={}, headers=_auth(auth_token))
    assert resp.status_code == 422


async def test_consent_single_key_upsert_leaves_the_other_untouched(client, auth_token):
    first = await client.post(
        "/api/v1/auth/consent",
        json={"terms": "2026-09-30", "privacy": "2026-09-30"},
        headers=_auth(auth_token),
    )
    assert first.status_code == 200
    privacy_before = first.json()["consents"]["privacy"]

    second = await client.post(
        "/api/v1/auth/consent", json={"terms": "2026-11-01"}, headers=_auth(auth_token)
    )

    assert second.status_code == 200
    consents = second.json()["consents"]
    assert consents["terms"]["version"] == "2026-11-01"
    assert consents["privacy"] == privacy_before


async def test_consent_both_keys_returns_user_response(client, auth_token):
    resp = await client.post(
        "/api/v1/auth/consent",
        json={"terms": "2026-09-30", "privacy": "2026-10-01"},
        headers=_auth(auth_token),
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "user@example.com"
    assert data["consents"]["terms"]["version"] == "2026-09-30"
    assert data["consents"]["privacy"]["version"] == "2026-10-01"
    assert "accepted_at" in data["consents"]["terms"]
    # /me reflects the stored record
    assert (await _me(client, auth_token))["consents"] == data["consents"]


async def test_consent_bumps_updated_at(client, auth_token):
    before = (await _me(client, auth_token))["updated_at"]

    resp = await client.post(
        "/api/v1/auth/consent", json={"privacy": "2026-09-30"}, headers=_auth(auth_token)
    )

    assert resp.json()["updated_at"] >= before


async def test_re_saving_the_same_version_keeps_the_original_acceptance_date(client, auth_token):
    """The record is evidence of when consent was given — re-saving an unchanged
    version (the profile's consent page does this) must not move accepted_at."""
    before = (await _me(client, auth_token))["consents"]

    resp = await client.post(
        "/api/v1/auth/consent",
        json={"terms": before["terms"]["version"], "privacy": before["privacy"]["version"]},
        headers=_auth(auth_token),
    )

    assert resp.status_code == 200
    assert resp.json()["consents"] == before


async def test_a_new_version_replaces_only_that_documents_record(client, auth_token):
    before = (await _me(client, auth_token))["consents"]

    resp = await client.post(
        "/api/v1/auth/consent",
        json={"terms": "2027-01-01", "privacy": before["privacy"]["version"]},
        headers=_auth(auth_token),
    )

    consents = resp.json()["consents"]
    assert consents["terms"]["version"] == "2027-01-01"
    assert consents["terms"]["accepted_at"] != before["terms"]["accepted_at"]
    assert consents["privacy"] == before["privacy"]
