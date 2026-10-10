from src.core.config import settings
from tests.factories import register_verify_and_login

EMAIL = "resetme@example.com"
PASSWORD = "originalpassword1"


async def _register(client, mock_email, email=EMAIL, password=PASSWORD):
    """A verified, logged-in account; returns its TokenResponse body."""
    return await register_verify_and_login(client, mock_email, email, password)


async def _raw_token(mock_email) -> str:
    link = mock_email.sent_password_resets[-1]["reset_link"]
    return link.split("token=", 1)[1]


async def test_forgot_password_same_response_for_known_and_unknown(client, mock_email):
    await _register(client, mock_email)
    known = await client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})
    unknown = await client.post(
        "/api/v1/auth/forgot-password", json={"email": "ghost@example.com"}
    )
    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()
    assert len(mock_email.sent_password_resets) == 1  # only the known email got one


async def test_forgot_password_rate_limited_returns_429(client):
    for _ in range(settings.password_reset_rate_limit_max_attempts):
        resp = await client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})
        assert resp.status_code == 200
    resp = await client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})
    assert resp.status_code == 429


async def test_full_reset_flow(client, mock_email):
    await _register(client, mock_email)
    resp = await client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})
    assert resp.status_code == 200

    token = await _raw_token(mock_email)
    resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "brandnewpassword1"},
    )
    assert resp.status_code == 200

    old_login = await client.post(
        "/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD}
    )
    assert old_login.status_code == 401
    new_login = await client.post(
        "/api/v1/auth/login", json={"email": EMAIL, "password": "brandnewpassword1"}
    )
    assert new_login.status_code == 200


async def test_reset_revokes_existing_refresh_tokens(client, mock_email):
    tokens = await _register(client, mock_email)
    await client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})
    raw = await _raw_token(mock_email)
    resp = await client.post(
        "/api/v1/auth/reset-password", json={"token": raw, "new_password": "brandnewpassword1"}
    )
    assert resp.status_code == 200

    refresh = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refresh.status_code == 401


async def test_reset_with_invalid_token_returns_400(client):
    resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": "garbage", "new_password": "brandnewpassword1"},
    )
    assert resp.status_code == 400


async def test_reset_with_reused_token_returns_400(client, mock_email):
    await _register(client, mock_email)
    await client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})
    token = await _raw_token(mock_email)
    first = await client.post(
        "/api/v1/auth/reset-password", json={"token": token, "new_password": "brandnewpassword1"}
    )
    assert first.status_code == 200
    second = await client.post(
        "/api/v1/auth/reset-password", json={"token": token, "new_password": "otherpassword12"}
    )
    assert second.status_code == 400


async def test_reset_with_expired_token_returns_410(client, mock_email, mock_db):
    from datetime import UTC, datetime, timedelta

    await _register(client, mock_email)
    await client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})
    token = await _raw_token(mock_email)
    await mock_db["password_reset_tokens"].update_many(
        {}, {"$set": {"expires_at": datetime.now(UTC) - timedelta(minutes=1)}}
    )
    resp = await client.post(
        "/api/v1/auth/reset-password", json={"token": token, "new_password": "brandnewpassword1"}
    )
    assert resp.status_code == 410


# --- password policy on reset ---


async def test_reset_to_a_weak_password_is_refused_and_the_link_still_works(client, mock_email):
    """A refused password must not burn the single-use link."""
    await _register(client, mock_email)
    await client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})
    token = await _raw_token(mock_email)

    common = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "passwordpassword"},
    )
    personal = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "plum-resetme-harbour"},
    )
    good = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "plum-harbour-lantern-42"},
    )

    assert common.status_code == 422
    assert common.json()["code"] == "weak_password"
    assert personal.status_code == 422
    assert personal.json()["detail"] == "Password must not contain your name or email address"
    assert good.status_code == 200
    login = await client.post(
        "/api/v1/auth/login", json={"email": EMAIL, "password": "plum-harbour-lantern-42"}
    )
    assert login.status_code == 200


async def test_reset_with_an_unknown_token_and_a_weak_password_reports_the_password(client):
    """Strength is checked first and needs no token, so it reveals nothing about one."""
    resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": "nope", "new_password": "passwordpassword"},
    )
    assert resp.status_code == 422
