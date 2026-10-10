from bson import ObjectId

from src.core.config import settings
from tests.factories import DEFAULT_PASSWORD, VALID_READING_BODY, register_verify_and_login

URL = "/api/v1/auth/me"
EMAIL = "leaver@example.com"

# Every collection that can hold something belonging to a user
USER_COLLECTIONS = (
    "users",
    "refresh_tokens",
    "password_reset_tokens",
    "email_verification_tokens",
    "readings",
    "interpretations",
    "user_tags",
    "password_reset_attempts",
)


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _delete(client, token: str | None, password: str = DEFAULT_PASSWORD):
    return await client.request(
        "DELETE", URL, json={"password": password}, headers=_auth(token) if token else {}
    )


async def _account_with_data(client, mock_email, email: str = EMAIL) -> str:
    """A verified account that owns a reading with an interpretation and a tag, a live
    reset token and throttle records. Returns its access token."""
    token = (await register_verify_and_login(client, mock_email, email))["access_token"]
    reading = await client.post("/api/v1/readings", json=VALID_READING_BODY, headers=_auth(token))
    assert reading.status_code == 201, reading.text
    reading_id = reading.json()["_id"]
    generated = await client.post(
        f"/api/v1/readings/{reading_id}/interpretation", headers=_auth(token)
    )
    assert generated.status_code in (200, 201), generated.text
    tagged = await client.patch(
        f"/api/v1/readings/{reading_id}/tags", json={"tags": "career"}, headers=_auth(token)
    )
    assert tagged.status_code == 200, tagged.text
    forgot = await client.post("/api/v1/auth/forgot-password", json={"email": email})
    assert forgot.status_code == 200
    return token


async def _counts(mock_db) -> dict[str, int]:
    return {name: await mock_db[name].count_documents({}) for name in USER_COLLECTIONS}


async def test_delete_requires_authentication(client):
    resp = await _delete(client, None)
    assert resp.status_code == 401


async def test_delete_requires_a_password_in_the_body(client, auth_token):
    resp = await client.request("DELETE", URL, json={}, headers=_auth(auth_token))
    assert resp.status_code == 422


async def test_delete_with_wrong_password_is_refused_and_deletes_nothing(
    client, mock_email, mock_db
):
    token = await _account_with_data(client, mock_email)
    before = await _counts(mock_db)

    resp = await _delete(client, token, password="wrongpassword123")

    # 403, not 401: the caller IS authenticated, and a 401 would make the frontend
    # treat the session as expired and silently refresh-and-retry.
    assert resp.status_code == 403
    assert resp.json()["code"] == "invalid_password"
    after = await _counts(mock_db)
    after["password_reset_attempts"] = before["password_reset_attempts"]  # the attempt itself
    assert after == before
    assert (await client.get(URL, headers=_auth(token))).status_code == 200


async def test_delete_removes_the_user_from_every_collection(client, mock_email, mock_db):
    token = await _account_with_data(client, mock_email)
    user_id = str((await mock_db["users"].find_one({"email": EMAIL}))["_id"])
    before = await _counts(mock_db)
    populated = [name for name in USER_COLLECTIONS if name != "email_verification_tokens"]
    assert all(before[name] >= 1 for name in populated)

    resp = await _delete(client, token)

    assert resp.status_code == 204
    assert resp.content == b""
    after = await _counts(mock_db)
    # The only thing left is the register limiter's record, which is keyed by network
    # address alone — it names neither the account's email nor its id.
    throttle_keys = [doc["key"] async for doc in mock_db["password_reset_attempts"].find()]
    assert all(EMAIL not in key and user_id not in key for key in throttle_keys)
    assert all(key.startswith("register:") for key in throttle_keys)
    after.pop("password_reset_attempts")
    assert after == dict.fromkeys(
        [n for n in USER_COLLECTIONS if n != "password_reset_attempts"], 0
    )


async def test_delete_leaves_other_users_data_alone(client, mock_email, mock_db):
    token = await _account_with_data(client, mock_email)
    other = await _account_with_data(client, mock_email, email="stayer@example.com")

    assert (await _delete(client, token)).status_code == 204

    assert await mock_db["users"].count_documents({}) == 1
    assert await mock_db["readings"].count_documents({}) == 1
    assert await mock_db["interpretations"].count_documents({}) == 1
    assert await mock_db["user_tags"].count_documents({}) == 1
    assert await mock_db["refresh_tokens"].count_documents({}) == 1
    assert await mock_db["password_reset_tokens"].count_documents({}) == 1
    me = await client.get(URL, headers=_auth(other))
    assert me.status_code == 200
    assert me.json()["email"] == "stayer@example.com"


async def test_second_delete_is_401_because_the_user_is_gone(client, mock_email):
    token = await _account_with_data(client, mock_email)
    assert (await _delete(client, token)).status_code == 204

    assert (await _delete(client, token)).status_code == 401
    assert (await client.get(URL, headers=_auth(token))).status_code == 401


async def test_deleted_account_cannot_log_in_or_refresh(client, mock_email):
    tokens = await register_verify_and_login(client, mock_email, EMAIL)
    assert (await _delete(client, tokens["access_token"])).status_code == 204

    login = await client.post(
        "/api/v1/auth/login", json={"email": EMAIL, "password": DEFAULT_PASSWORD}
    )
    refresh = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )

    assert login.status_code == 401
    assert refresh.status_code == 401


async def test_deleted_email_can_register_again(client, mock_email):
    tokens = await register_verify_and_login(client, mock_email, EMAIL)
    assert (await _delete(client, tokens["access_token"])).status_code == 204

    again = await register_verify_and_login(client, mock_email, EMAIL)

    assert "access_token" in again


async def test_delete_password_guessing_is_rate_limited(client, auth_token):
    last = None
    for _ in range(settings.login_rate_limit_max_attempts + 1):
        last = await _delete(client, auth_token, password="wrongpassword123")
    assert last.status_code == 429

    # Even the right password is refused while throttled, and nothing was deleted
    assert (await _delete(client, auth_token)).status_code == 429
    assert (await client.get(URL, headers=_auth(auth_token))).status_code == 200


async def test_delete_ignores_identity_fields_in_the_body(client, mock_email, mock_db):
    """Identity comes from the JWT only — a body cannot aim the delete at someone else."""
    token = await _account_with_data(client, mock_email)
    other = await register_verify_and_login(client, mock_email, "bystander@example.com")
    bystander = await mock_db["users"].find_one({"email": "bystander@example.com"})

    resp = await client.request(
        "DELETE",
        URL,
        json={"password": DEFAULT_PASSWORD, "user_id": str(bystander["_id"])},
        headers=_auth(token),
    )

    assert resp.status_code == 204
    assert await mock_db["users"].find_one({"_id": ObjectId(bystander["_id"])}) is not None
    assert (await client.get(URL, headers=_auth(other["access_token"]))).status_code == 200
