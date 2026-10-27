"""DELETE /api/v1/users/{user_id} — superadmin deletion through the same cascade as
self-service (DeleteUserHandler)."""

from bson import ObjectId
from structlog.testing import capture_logs

from tests.factories import VALID_READING_BODY, invite, register_verify_and_login

ME = "/api/v1/auth/me"


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _target_id(mock_db, email: str) -> str:
    doc = await mock_db["users"].find_one({"email": email})
    return str(doc["_id"])


async def test_delete_user_unauthenticated_is_401(client):
    resp = await client.delete(f"/api/v1/users/{ObjectId()}")
    assert resp.status_code == 401


async def test_delete_user_as_regular_user_is_403(client, auth_token, mock_db):
    target = await _target_id(mock_db, "user@example.com")
    resp = await client.delete(f"/api/v1/users/{target}", headers=_auth(auth_token))
    assert resp.status_code == 403


async def test_delete_unknown_user_is_404(client, superadmin_token):
    resp = await client.delete(f"/api/v1/users/{ObjectId()}", headers=_auth(superadmin_token))
    assert resp.status_code == 404


async def test_admin_cannot_delete_their_own_account_here(client, superadmin_token, mock_db):
    """The self-service path re-verifies the password; this one does not, so it must
    not be a shortcut past that check."""
    own = await _target_id(mock_db, "admin@example.com")

    resp = await client.delete(f"/api/v1/users/{own}", headers=_auth(superadmin_token))

    assert resp.status_code == 409
    assert await mock_db["users"].find_one({"email": "admin@example.com"}) is not None


async def test_delete_user_cascades_and_ends_their_session(
    client, superadmin_token, mock_email, mock_db
):
    tokens = await register_verify_and_login(client, mock_email, "seeker@example.com")
    seeker = _auth(tokens["access_token"])
    reading = await client.post("/api/v1/readings", json=VALID_READING_BODY, headers=seeker)
    assert reading.status_code == 201
    target = await _target_id(mock_db, "seeker@example.com")

    with capture_logs() as logs:
        resp = await client.delete(f"/api/v1/users/{target}", headers=_auth(superadmin_token))

    assert resp.status_code == 204
    assert await mock_db["users"].find_one({"email": "seeker@example.com"}) is None
    assert await mock_db["readings"].count_documents({"user_id": ObjectId(target)}) == 0
    assert await mock_db["refresh_tokens"].count_documents({"user_id": target}) == 0
    assert (await client.get(ME, headers=seeker)).status_code == 401
    assert "account deleted by admin" in str(logs)


async def test_delete_an_invited_user_removes_the_invite(
    client, superadmin_token, mock_email, mock_db
):
    await invite(client, superadmin_token, "invitee@example.com")
    target = await _target_id(mock_db, "invitee@example.com")

    resp = await client.delete(f"/api/v1/users/{target}", headers=_auth(superadmin_token))

    assert resp.status_code == 204
    assert await mock_db["users"].find_one({"email": "invitee@example.com"}) is None
    assert await mock_db["email_verification_tokens"].count_documents({"user_id": target}) == 0
