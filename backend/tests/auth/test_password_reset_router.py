from src.core.config import settings

EMAIL = "resetme@example.com"
PASSWORD = "originalpassword1"


async def _register(client, email=EMAIL, password=PASSWORD):
    resp = await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _raw_token(mock_email) -> str:
    link = mock_email.sent_password_resets[-1]["reset_link"]
    return link.split("token=", 1)[1]


async def test_forgot_password_same_response_for_known_and_unknown(client, mock_email):
    await _register(client)
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
    await _register(client)
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
    tokens = await _register(client)
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
    await _register(client)
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

    await _register(client)
    await client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})
    token = await _raw_token(mock_email)
    await mock_db["password_reset_tokens"].update_many(
        {}, {"$set": {"expires_at": datetime.now(UTC) - timedelta(minutes=1)}}
    )
    resp = await client.post(
        "/api/v1/auth/reset-password", json={"token": token, "new_password": "brandnewpassword1"}
    )
    assert resp.status_code == 410
