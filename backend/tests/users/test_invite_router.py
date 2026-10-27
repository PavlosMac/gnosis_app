"""POST /api/v1/users/invite — superadmin creates an invited account and mails the link."""

from datetime import UTC, datetime, timedelta

import pytest

from src.auth.repository import AuthReadRepository
from src.core.security import ensure_utc, hash_token
from src.database.collections.constants import EMAIL_VERIFICATION_TOKENS_COLLECTION
from src.notifications.errors import EmailDeliveryError
from src.notifications.mock_adapter import MockEmailAdapter
from tests.factories import invite, invite_token, register_verify_and_login

INVITE = "/api/v1/users/invite"
EMAIL = "invitee@example.com"


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_invite_unauthenticated_is_401(client):
    resp = await client.post(INVITE, json={"email": EMAIL})
    assert resp.status_code == 401


async def test_invite_as_regular_user_is_403(client, auth_token):
    resp = await client.post(INVITE, json={"email": EMAIL}, headers=_auth(auth_token))
    assert resp.status_code == 403


async def test_invite_creates_an_invited_user_and_mails_the_link(
    client, superadmin_token, mock_email, mock_db
):
    resp = await client.post(
        INVITE, json={"email": "  Invitee@Example.com "}, headers=_auth(superadmin_token)
    )

    assert resp.status_code == 200
    assert resp.json() == {"detail": "Invitation sent"}

    doc = await mock_db["users"].find_one({"email": EMAIL})
    assert doc is not None
    assert doc["status"] == "invited"
    assert "password_hash" not in doc
    assert "consents" not in doc
    assert ensure_utc(doc["verification_deadline_at"]) > datetime.now(UTC) + timedelta(days=6)

    assert len(mock_email.sent_invites) == 1
    sent = mock_email.sent_invites[0]
    assert sent["to"] == EMAIL
    assert sent["invite_link"].startswith("http://localhost:3000/accept-invite?token=")

    stored = await mock_db[EMAIL_VERIFICATION_TOKENS_COLLECTION].find_one(
        {"token_hash": hash_token(invite_token(mock_email))}
    )
    assert stored is not None
    assert stored["user_id"] == str(doc["_id"])


async def test_reinvite_rotates_the_token_and_extends_the_deadline(
    client, superadmin_token, mock_email, mock_db
):
    await invite(client, superadmin_token, EMAIL)
    first_token = invite_token(mock_email)
    await mock_db["users"].update_one(
        {"email": EMAIL}, {"$set": {"verification_deadline_at": datetime.now(UTC)}}
    )

    await invite(client, superadmin_token, EMAIL)

    assert len(mock_email.sent_invites) == 2
    second_token = invite_token(mock_email)
    assert second_token != first_token
    tokens = mock_db[EMAIL_VERIFICATION_TOKENS_COLLECTION]
    assert await tokens.find_one({"token_hash": hash_token(first_token)}) is None
    assert await tokens.find_one({"token_hash": hash_token(second_token)}) is not None
    assert await mock_db["users"].count_documents({"email": EMAIL}) == 1
    doc = await mock_db["users"].find_one({"email": EMAIL})
    assert ensure_utc(doc["verification_deadline_at"]) > datetime.now(UTC) + timedelta(days=6)


async def test_invite_of_an_existing_account_is_409(client, superadmin_token, mock_email):
    await register_verify_and_login(client, mock_email, "taken@example.com")

    resp = await client.post(
        INVITE, json={"email": "taken@example.com"}, headers=_auth(superadmin_token)
    )

    assert resp.status_code == 409
    assert mock_email.sent_invites == []


async def test_invited_user_cannot_log_in(client, superadmin_token, mock_email):
    await invite(client, superadmin_token, EMAIL)

    resp = await client.post(
        "/api/v1/auth/login", json={"email": EMAIL, "password": "irrelevant-password-1"}
    )

    assert resp.status_code == 401


async def test_invite_appears_in_the_user_list_with_status(client, superadmin_token):
    await invite(client, superadmin_token, EMAIL)

    resp = await client.get("/api/v1/users", headers=_auth(superadmin_token))

    assert resp.status_code == 200
    by_email = {u["email"]: u for u in resp.json()["items"]}
    assert by_email[EMAIL]["status"] == "invited"
    assert by_email["admin@example.com"]["status"] == "active"


class FailingInviteEmail(MockEmailAdapter):
    async def send_invite(self, to: str, invite_link: str) -> None:
        raise EmailDeliveryError()


async def test_invite_surfaces_a_delivery_failure_as_502(app, client, superadmin_token, mock_db):
    """The admin is looking at the screen: unlike registration, a failed send must be
    visible so they can resend, and the invited account must still exist for that."""
    from src.cqrs.mediator import Mediator
    from src.llm.mock_adapter import MockLLMAdapter
    from src.main import _wire_mediator

    mediator = Mediator()
    _wire_mediator(mediator, MockLLMAdapter(), FailingInviteEmail(), mock_db)
    app.state.mediator = mediator

    resp = await client.post(INVITE, json={"email": EMAIL}, headers=_auth(superadmin_token))

    assert resp.status_code == 502
    assert await mock_db["users"].find_one({"email": EMAIL}) is not None


class BlindOnce(AuthReadRepository):
    """Reports "no such account" on its first lookup after `blind` is set, as the loser
    of an invite race saw it."""

    def __init__(self, db) -> None:
        super().__init__(db)
        self.blind = True

    async def find_by_email(self, email):
        if self.blind:
            self.blind = False
            return None
        return await super().find_by_email(email)


async def test_invite_that_loses_the_insert_race_resends_instead_of_500(mock_db):
    """Two invites for a new address both see "no account"; the second insert hits the
    unique email index. It must fall through to the resend path, not raise."""
    from src.auth.models import UserStatus
    from src.auth.repository import (
        AuthWriteRepository,
        EmailVerificationTokenRepository,
    )
    from src.users.commands.invite_user import InviteUserCommand, InviteUserHandler

    await mock_db["users"].create_index("email", unique=True)

    mail = MockEmailAdapter()
    read_repo = BlindOnce(mock_db)
    handler = InviteUserHandler(
        read_repo,
        AuthWriteRepository(mock_db),
        EmailVerificationTokenRepository(mock_db),
        mail,
    )
    command = InviteUserCommand(email=EMAIL, admin_id="a" * 24)
    first = await handler.handle(command)
    read_repo.blind = True  # the second request's lookup raced the first insert
    second = await handler.handle(command)

    assert first == second
    assert await mock_db["users"].count_documents({"email": EMAIL}) == 1
    assert (await mock_db["users"].find_one({"email": EMAIL}))["status"] == UserStatus.INVITED
    assert len(mail.sent_invites) == 2


async def test_invite_that_loses_the_race_to_a_real_signup_is_409(mock_db):
    from src.auth.repository import (
        AuthWriteRepository,
        EmailVerificationTokenRepository,
    )
    from src.auth.service import EmailAlreadyExistsError
    from src.users.commands.invite_user import InviteUserCommand, InviteUserHandler

    await mock_db["users"].create_index("email", unique=True)
    await mock_db["users"].insert_one({"email": EMAIL, "status": "active"})

    mail = MockEmailAdapter()
    handler = InviteUserHandler(
        BlindOnce(mock_db),
        AuthWriteRepository(mock_db),
        EmailVerificationTokenRepository(mock_db),
        mail,
    )

    with pytest.raises(EmailAlreadyExistsError):
        await handler.handle(InviteUserCommand(email=EMAIL, admin_id="a" * 24))
    assert mail.sent_invites == []


async def test_resend_does_not_touch_an_account_that_was_just_accepted(mock_db):
    """Resend read the account as invited, then the invitee accepted. The guarded
    update must refuse: no stale deadline on the active user, no mail for a dead link."""
    from src.auth.repository import (
        AuthReadRepository,
        AuthWriteRepository,
        EmailVerificationTokenRepository,
    )
    from src.auth.service import EmailAlreadyExistsError
    from src.users.commands.invite_user import InviteUserCommand, InviteUserHandler

    await mock_db["users"].insert_one(
        {"email": EMAIL, "status": "invited", "verification_deadline_at": datetime.now(UTC)}
    )

    class AcceptsAfterRead(AuthReadRepository):
        async def find_by_email(self, email):
            doc = await super().find_by_email(email)
            await mock_db["users"].update_one(
                {"email": email},
                {"$set": {"status": "active"}, "$unset": {"verification_deadline_at": ""}},
            )
            return doc

    mail = MockEmailAdapter()
    handler = InviteUserHandler(
        AcceptsAfterRead(mock_db),
        AuthWriteRepository(mock_db),
        EmailVerificationTokenRepository(mock_db),
        mail,
    )

    with pytest.raises(EmailAlreadyExistsError):
        await handler.handle(InviteUserCommand(email=EMAIL, admin_id="a" * 24))

    doc = await mock_db["users"].find_one({"email": EMAIL})
    assert doc["status"] == "active"
    assert "verification_deadline_at" not in doc
    assert mail.sent_invites == []
