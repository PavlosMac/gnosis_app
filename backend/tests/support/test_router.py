from src.core.config import settings
from tests.support.conftest import SUPPORT_INBOX, FailingEmailAdapter

URL = "/api/v1/support/contact"
BODY = {"subject": "Card missing", "message": "The Tower vanished from my spread."}


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def test_contact_relays_email_with_jwt_identity(client, auth_token, mock_email):
    resp = await client.post(URL, json=BODY, headers=_headers(auth_token))

    assert resp.status_code == 200, resp.text
    assert resp.json() == {"message": "Your message has been received."}
    assert len(mock_email.sent_support_requests) == 1
    sent = mock_email.sent_support_requests[0]
    assert sent["to"] == SUPPORT_INBOX
    assert sent["reply_to"] == "user@example.com"  # the registered user from auth_token
    assert sent["subject"] == BODY["subject"]
    assert sent["message"] == BODY["message"]


async def test_contact_ignores_identity_fields_in_body(client, auth_token, mock_email):
    forged = {**BODY, "email": "attacker@example.com", "user_id": "000000000000000000000001"}
    resp = await client.post(URL, json=forged, headers=_headers(auth_token))

    assert resp.status_code == 200, resp.text
    sent = mock_email.sent_support_requests[0]
    assert sent["reply_to"] == "user@example.com"
    assert sent["user_id"] != "000000000000000000000001"


async def test_contact_trims_whitespace(client, auth_token, mock_email):
    padded = {"subject": "  Card missing  ", "message": "\n  The Tower vanished from my spread. \n"}
    resp = await client.post(URL, json=padded, headers=_headers(auth_token))

    assert resp.status_code == 200, resp.text
    sent = mock_email.sent_support_requests[0]
    assert sent["subject"] == "Card missing"
    assert sent["message"] == "The Tower vanished from my spread."


async def test_contact_requires_auth(client, mock_email):
    resp = await client.post(URL, json=BODY)
    assert resp.status_code == 401
    assert mock_email.sent_support_requests == []


async def test_contact_rejects_short_subject(client, auth_token):
    resp = await client.post(URL, json={**BODY, "subject": "Hi"}, headers=_headers(auth_token))
    assert resp.status_code == 422


async def test_contact_rejects_long_subject(client, auth_token):
    resp = await client.post(URL, json={**BODY, "subject": "x" * 201}, headers=_headers(auth_token))
    assert resp.status_code == 422


async def test_contact_rejects_short_message(client, auth_token):
    resp = await client.post(
        URL, json={**BODY, "message": "too short"}, headers=_headers(auth_token)
    )
    assert resp.status_code == 422


async def test_contact_rejects_long_message(client, auth_token):
    resp = await client.post(
        URL, json={**BODY, "message": "x" * 5001}, headers=_headers(auth_token)
    )
    assert resp.status_code == 422


async def test_contact_rejects_whitespace_only_message(client, auth_token):
    resp = await client.post(URL, json={**BODY, "message": " " * 50}, headers=_headers(auth_token))
    assert resp.status_code == 422


async def test_contact_rate_limited_returns_429(client, auth_token, mock_email):
    for _ in range(settings.support_contact_rate_limit_max_attempts):
        resp = await client.post(URL, json=BODY, headers=_headers(auth_token))
        assert resp.status_code == 200, resp.text

    resp = await client.post(URL, json=BODY, headers=_headers(auth_token))
    assert resp.status_code == 429
    assert len(mock_email.sent_support_requests) == (
        settings.support_contact_rate_limit_max_attempts
    )


async def test_contact_returns_502_when_email_fails(app, client, auth_token, mock_db):
    from src.cqrs.mediator import Mediator
    from src.llm.mock_adapter import MockLLMAdapter
    from src.main import _wire_mediator

    mediator = Mediator()
    _wire_mediator(mediator, MockLLMAdapter(), FailingEmailAdapter(), mock_db)
    app.state.mediator = mediator

    resp = await client.post(URL, json=BODY, headers=_headers(auth_token))
    assert resp.status_code == 502


async def test_contact_returns_503_when_inbox_unconfigured(
    client, auth_token, mock_email, monkeypatch
):
    monkeypatch.setattr(settings, "support_email", "")
    resp = await client.post(URL, json=BODY, headers=_headers(auth_token))
    assert resp.status_code == 503
    assert mock_email.sent_support_requests == []
