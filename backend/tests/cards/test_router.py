from src.database.collections.constants import MAJOR_ARCANA_MEANINGS_COLLECTION

FOOL = {
    "number": 0,
    "name": "The Fool",
    "slug": "the-fool",
    "upright": "A step into open air.",
    "shadow": "A step taken blind.",
    "word_count": 9,
    "model": "gpt-test",
    "effort": "medium",
    "generated_at": "2026-11-10T00:00:00Z",
}


async def test_get_major_arcana_meaning_returns_the_stored_text(client, auth_token, mock_db):
    await mock_db[MAJOR_ARCANA_MEANINGS_COLLECTION].insert_one(dict(FOOL))

    response = await client.get(
        "/api/v1/cards/major-arcana/0", headers={"Authorization": f"Bearer {auth_token}"}
    )

    assert response.status_code == 200, response.text
    assert response.json() == {
        "number": 0,
        "name": "The Fool",
        "upright": "A step into open air.",
        "shadow": "A step taken blind.",
    }


async def test_get_major_arcana_meaning_404_when_not_written(client, auth_token):
    response = await client.get(
        "/api/v1/cards/major-arcana/5", headers={"Authorization": f"Bearer {auth_token}"}
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "No meaning is written for this card yet"


async def test_get_major_arcana_meaning_rejects_numbers_outside_the_major_arcana(
    client, auth_token
):
    headers = {"Authorization": f"Bearer {auth_token}"}

    assert (await client.get("/api/v1/cards/major-arcana/22", headers=headers)).status_code == 422
    assert (await client.get("/api/v1/cards/major-arcana/-1", headers=headers)).status_code == 422


async def test_get_major_arcana_meaning_unauthenticated(client):
    response = await client.get("/api/v1/cards/major-arcana/0")
    assert response.status_code == 401
