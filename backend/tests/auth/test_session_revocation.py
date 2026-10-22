"""An access token is only as alive as its refresh family: ending the session by any
route (logout, password reset, refresh replay) ends the access token too."""

import jwt as pyjwt

from src.core.config import settings
from tests.factories import DEFAULT_PASSWORD, register_verify_and_login

EMAIL = "session@example.com"


def _bearer(tokens: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


async def _me(client, tokens: dict) -> int:
    return (await client.get("/api/v1/auth/me", headers=_bearer(tokens))).status_code


async def test_access_token_works_while_its_session_is_live(client, mock_email):
    tokens = await register_verify_and_login(client, mock_email, EMAIL)

    assert await _me(client, tokens) == 200


async def test_logout_ends_the_access_token(client, mock_email):
    tokens = await register_verify_and_login(client, mock_email, EMAIL)

    logout = await client.post("/api/v1/auth/logout", headers=_bearer(tokens))

    assert logout.status_code == 200
    assert await _me(client, tokens) == 401


async def test_logout_leaves_the_users_other_sessions_alone(client, mock_email):
    first = await register_verify_and_login(client, mock_email, EMAIL)
    second = (
        await client.post("/api/v1/auth/login", json={"email": EMAIL, "password": DEFAULT_PASSWORD})
    ).json()

    await client.post("/api/v1/auth/logout", headers=_bearer(first))

    assert await _me(client, first) == 401
    assert await _me(client, second) == 200


async def test_password_reset_ends_every_access_token(client, mock_email):
    tokens = await register_verify_and_login(client, mock_email, EMAIL)
    await client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})
    link = mock_email.sent_password_resets[-1]["reset_link"]

    reset = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": link.split("token=", 1)[1], "new_password": "brandnewpassword1"},
    )

    assert reset.status_code == 200
    assert await _me(client, tokens) == 401


async def test_refresh_rotation_keeps_the_previous_access_token_alive(client, mock_email):
    tokens = await register_verify_and_login(client, mock_email, EMAIL)

    refreshed = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )

    assert refreshed.status_code == 200
    assert await _me(client, tokens) == 200
    assert await _me(client, refreshed.json()) == 200


async def test_refresh_replay_ends_the_access_tokens_of_the_family(
    client, mock_email, monkeypatch
):
    monkeypatch.setattr("src.auth.service.REFRESH_REPLAY_GRACE_SECONDS", -1)
    tokens = await register_verify_and_login(client, mock_email, EMAIL)
    refreshed = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )

    replay = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )

    assert replay.status_code == 401
    assert await _me(client, tokens) == 401
    assert await _me(client, refreshed.json()) == 401


async def test_racing_refresh_does_not_end_the_winners_session(client, mock_email):
    tokens = await register_verify_and_login(client, mock_email, EMAIL)
    winner = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )

    loser = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )

    assert loser.status_code == 401
    assert await _me(client, winner.json()) == 200
    follow_up = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": winner.json()["refresh_token"]}
    )
    assert follow_up.status_code == 200


async def test_access_token_without_a_family_is_rejected(client, mock_email):
    tokens = await register_verify_and_login(client, mock_email, EMAIL)
    payload = pyjwt.decode(
        tokens["access_token"], settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
    )
    familyless = pyjwt.encode(
        {"sub": payload["sub"], "exp": payload["exp"], "type": "access"},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {familyless}"})

    assert resp.status_code == 401
