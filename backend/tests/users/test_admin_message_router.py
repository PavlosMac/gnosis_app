"""POST /api/v1/users/{user_id}/email — one-way note from the superadmin to one user."""

from bson import ObjectId
from structlog.testing import capture_logs

from src.notifications.errors import EmailDeliveryError
from src.notifications.mock_adapter import MockEmailAdapter
from tests.factories import register_verify_and_login

BODY = {"subject": "A word from the oracle", "message": "Welcome aboard.\n\nEnjoy."}


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _target_id(mock_db, email: str) -> str:
    doc = await mock_db["users"].find_one({"email": email})
    return str(doc["_id"])


async def test_email_user_unauthenticated_is_401(client):
    resp = await client.post(f"/api/v1/users/{ObjectId()}/email", json=BODY)
    assert resp.status_code == 401


async def test_email_user_as_regular_user_is_403(client, auth_token, mock_db):
    target = await _target_id(mock_db, "user@example.com")
    resp = await client.post(f"/api/v1/users/{target}/email", json=BODY, headers=_auth(auth_token))
    assert resp.status_code == 403


async def test_email_unknown_user_is_404(client, superadmin_token, mock_email):
    resp = await client.post(
        f"/api/v1/users/{ObjectId()}/email", json=BODY, headers=_auth(superadmin_token)
    )
    assert resp.status_code == 404
    assert mock_email.sent_admin_messages == []


async def test_email_user_sends_the_message_and_logs_no_content(
    client, superadmin_token, mock_email, mock_db
):
    await register_verify_and_login(client, mock_email, "seeker@example.com")
    target = await _target_id(mock_db, "seeker@example.com")

    with capture_logs() as logs:
        resp = await client.post(
            f"/api/v1/users/{target}/email", json=BODY, headers=_auth(superadmin_token)
        )

    assert resp.status_code == 200
    assert resp.json() == {"detail": "Email sent"}
    assert mock_email.sent_admin_messages == [
        {"to": "seeker@example.com", "subject": BODY["subject"], "message": BODY["message"]}
    ]
    logged = str(logs)
    assert "admin message sent" in logged
    assert "seeker@example.com" not in logged
    assert "Welcome aboard" not in logged


async def test_email_user_rejects_blank_subject(client, superadmin_token, mock_db):
    target = await _target_id(mock_db, "admin@example.com")
    resp = await client.post(
        f"/api/v1/users/{target}/email",
        json={"subject": "", "message": "x"},
        headers=_auth(superadmin_token),
    )
    assert resp.status_code == 422


class FailingAdminMessageEmail(MockEmailAdapter):
    async def send_admin_message(self, to: str, subject: str, message: str) -> None:
        raise EmailDeliveryError()


async def test_email_user_surfaces_a_delivery_failure_as_502(
    app, client, superadmin_token, mock_db
):
    from src.cqrs.mediator import Mediator
    from src.llm.mock_adapter import MockLLMAdapter
    from src.main import _wire_mediator

    mediator = Mediator()
    _wire_mediator(mediator, MockLLMAdapter(), FailingAdminMessageEmail(), mock_db)
    app.state.mediator = mediator
    target = await _target_id(mock_db, "admin@example.com")

    resp = await client.post(
        f"/api/v1/users/{target}/email", json=BODY, headers=_auth(superadmin_token)
    )

    assert resp.status_code == 502
