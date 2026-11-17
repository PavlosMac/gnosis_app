from src.database.collections.constants import (
    MAJOR_ARCANA_MEANINGS_COLLECTION,
    SPREAD_CARD_MEANINGS_COLLECTION,
)

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


# --- spread card meanings: public, all 78 cards ---

JUSTICE = {
    "number": 11,
    "name": "Justice",
    "slug": "justice",
    "meaning": "Truth and balance.\n\nIts shadow is coldness.",
    "word_count": 7,
    "model": "gpt-test",
    "effort": "medium",
    "generated_at": "2026-11-17T00:00:00Z",
}


async def test_get_spread_card_meaning_returns_the_stored_text_without_a_session(client, mock_db):
    await mock_db[SPREAD_CARD_MEANINGS_COLLECTION].insert_one(dict(JUSTICE))

    response = await client.get("/api/v1/cards/spread/11")

    assert response.status_code == 200, response.text
    assert response.json() == {
        "number": 11,
        "name": "Justice",
        "meaning": "Truth and balance.\n\nIts shadow is coldness.",
    }


async def test_get_spread_card_meaning_covers_the_minor_arcana(client, mock_db):
    await mock_db[SPREAD_CARD_MEANINGS_COLLECTION].insert_one(
        {**JUSTICE, "number": 77, "name": "King of Swords"}
    )

    response = await client.get("/api/v1/cards/spread/77")

    assert response.status_code == 200
    assert response.json()["name"] == "King of Swords"


async def test_get_spread_card_meaning_404_when_not_written(client):
    response = await client.get("/api/v1/cards/spread/40")

    assert response.status_code == 404
    assert response.json()["detail"] == "No meaning is written for this card yet"


async def test_get_spread_card_meaning_rejects_numbers_outside_the_deck(client):
    assert (await client.get("/api/v1/cards/spread/78")).status_code == 422
    assert (await client.get("/api/v1/cards/spread/-1")).status_code == 422


async def test_get_spread_card_meaning_does_not_read_the_day_card_collection(client, mock_db):
    await mock_db[MAJOR_ARCANA_MEANINGS_COLLECTION].insert_one(dict(FOOL))

    assert (await client.get("/api/v1/cards/spread/0")).status_code == 404
