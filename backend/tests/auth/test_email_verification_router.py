import time
from datetime import UTC, datetime, timedelta

from src.core.config import settings
from src.core.security import hash_password, hash_token
from src.database.collections.constants import EMAIL_VERIFICATION_TOKENS_COLLECTION
from tests.factories import (
    DEFAULT_PASSWORD,
    make_register_body,
    register_verify_and_login,
    verification_token,
)

EMAIL = "pending@example.com"
REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
VERIFY = "/api/v1/auth/verify-email"
RESEND = "/api/v1/auth/resend-verification"


async def _register(client, email: str = EMAIL):
    resp = await client.post(REGISTER, json=make_register_body(email=email))
    assert resp.status_code == 201, resp.text
    return resp


async def _login(client, email: str = EMAIL, password: str = DEFAULT_PASSWORD):
    return await client.post(LOGIN, json={"email": email, "password": password})


# --- register ---


async def test_register_returns_201_detail_and_no_tokens(client, mock_email, mock_db):
    resp = await _register(client)

    body = resp.json()
    assert set(body) == {"detail"}
    assert "access_token" not in body
    assert len(mock_email.sent_email_verifications) == 1
    sent = mock_email.sent_email_verifications[0]
    assert sent["to"] == EMAIL
    assert sent["verify_link"].startswith(f"{settings.frontend_base_url}/verify-email?token=")

    doc = await mock_db["users"].find_one({"email": EMAIL})
    assert doc["status"] == "pending_verification"
    assert "email_verified_at" not in doc
    assert doc["verification_deadline_at"] is not None


async def test_register_missing_names_or_consents_is_422(client):
    for missing in ("first_name", "last_name", "consents"):
        body = make_register_body()
        del body[missing]
        resp = await client.post(REGISTER, json=body)
        assert resp.status_code == 422, missing


async def test_register_stores_no_refresh_token(client, mock_db):
    await _register(client)
    assert await mock_db["refresh_tokens"].count_documents({}) == 0


# --- login gate ---


async def test_pending_login_is_403_with_code(client):
    await _register(client)

    resp = await _login(client)

    assert resp.status_code == 403
    assert resp.json()["code"] == "email_not_verified"
    assert "detail" in resp.json()


async def test_pending_login_with_wrong_password_is_401_not_403(client):
    """The status check runs after the password check, so a 403 never confirms that
    an account exists to someone who does not hold its password."""
    await _register(client)

    resp = await _login(client, password="wrongpassword123")

    assert resp.status_code == 401
    assert "code" not in resp.json()


async def test_legacy_document_without_status_can_log_in(client, mock_db):
    now = datetime.now(UTC)
    await mock_db["users"].insert_one(
        {
            "email": "legacy@example.com",
            "password_hash": hash_password(DEFAULT_PASSWORD),
            "created_at": now,
            "updated_at": now,
        }
    )

    resp = await _login(client, email="legacy@example.com")

    assert resp.status_code == 200
    me = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {resp.json()['access_token']}"}
    )
    assert me.json()["status"] == "active"
    assert me.json()["email_verified_at"] is None


# --- verify ---


async def test_verify_returns_detail_without_tokens_then_login_succeeds(client, mock_email):
    await _register(client)

    resp = await client.post(VERIFY, json={"token": verification_token(mock_email)})

    assert resp.status_code == 200
    assert set(resp.json()) == {"detail"}

    login = await _login(client)
    assert login.status_code == 200
    me = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"}
    )
    data = me.json()
    assert data["status"] == "active"
    assert data["email_verified_at"] is not None
    assert data["first_name"] == "Test"
    assert data["consents"]["terms"]["version"] == "2026-10-04"


async def test_verify_clears_the_purge_deadline(client, mock_email, mock_db):
    await _register(client)
    await client.post(VERIFY, json={"token": verification_token(mock_email)})

    doc = await mock_db["users"].find_one({"email": EMAIL})
    assert doc["status"] == "active"
    assert "verification_deadline_at" not in doc


async def test_verify_token_reuse_is_400(client, mock_email):
    await _register(client)
    token = verification_token(mock_email)
    assert (await client.post(VERIFY, json={"token": token})).status_code == 200

    assert (await client.post(VERIFY, json={"token": token})).status_code == 400


async def test_verify_unknown_token_is_400(client):
    assert (await client.post(VERIFY, json={"token": "nope"})).status_code == 400


async def test_verify_expired_token_is_410(client, mock_email, mock_db):
    await _register(client)
    token = verification_token(mock_email)
    await mock_db[EMAIL_VERIFICATION_TOKENS_COLLECTION].update_one(
        {"token_hash": hash_token(token)},
        {"$set": {"expires_at": datetime.now(UTC) - timedelta(minutes=1)}},
    )

    resp = await client.post(VERIFY, json={"token": token})

    assert resp.status_code == 410
    assert (await _login(client)).status_code == 403


async def test_verify_token_for_a_purged_user_is_400(client, mock_email, mock_db):
    await _register(client)
    await mock_db["users"].delete_one({"email": EMAIL})

    resp = await client.post(VERIFY, json={"token": verification_token(mock_email)})

    assert resp.status_code == 400


# --- resend ---


async def test_resend_rotates_the_token(client, mock_email):
    await _register(client)
    old = verification_token(mock_email)

    resp = await client.post(RESEND, json={"email": EMAIL})

    assert resp.status_code == 200
    assert len(mock_email.sent_email_verifications) == 2
    new = verification_token(mock_email)
    assert new != old
    assert (await client.post(VERIFY, json={"token": old})).status_code == 400
    assert (await client.post(VERIFY, json={"token": new})).status_code == 200


async def test_resend_is_case_insensitive(client, mock_email):
    await _register(client)

    await client.post(RESEND, json={"email": EMAIL.upper()})

    assert len(mock_email.sent_email_verifications) == 2


async def test_resend_extends_the_purge_deadline(client, mock_db):
    await _register(client)
    past = datetime.now(UTC) - timedelta(days=1)
    await mock_db["users"].update_one(
        {"email": EMAIL}, {"$set": {"verification_deadline_at": past}}
    )

    await client.post(RESEND, json={"email": EMAIL})

    doc = await mock_db["users"].find_one({"email": EMAIL})
    deadline = doc["verification_deadline_at"].replace(tzinfo=UTC)
    assert deadline > datetime.now(UTC) + timedelta(days=settings.pending_account_ttl_days - 1)
    # created_at keeps its meaning — the purge clock is a separate field
    assert doc["created_at"].replace(tzinfo=UTC) < datetime.now(UTC)


async def test_resend_unknown_and_active_are_silent_200(client, mock_email):
    await register_verify_and_login(client, mock_email, "active@example.com")
    sent_before = len(mock_email.sent_email_verifications)

    unknown = await client.post(RESEND, json={"email": "ghost@example.com"})
    active = await client.post(RESEND, json={"email": "active@example.com"})
    await _register(client)
    pending = await client.post(RESEND, json={"email": EMAIL})

    assert unknown.status_code == active.status_code == pending.status_code == 200
    assert unknown.json() == active.json() == pending.json()
    # Only the register and the pending resend sent anything
    assert len(mock_email.sent_email_verifications) == sent_before + 2


async def test_resend_rate_limited_returns_429(client):
    for _ in range(settings.password_reset_rate_limit_max_attempts):
        assert (await client.post(RESEND, json={"email": EMAIL})).status_code == 200
    assert (await client.post(RESEND, json={"email": EMAIL})).status_code == 429


async def test_resend_throttle_does_not_collide_with_password_reset(client):
    for _ in range(settings.password_reset_rate_limit_max_attempts):
        await client.post(RESEND, json={"email": EMAIL})

    resp = await client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})

    assert resp.status_code == 200


async def test_resend_does_not_send_on_the_request_path(app, client, mock_email, monkeypatch):
    """The pending branch must not be distinguishable by response time: the token
    issue and the send run after the response, so a slow provider cannot show."""
    await _register(client)
    original = mock_email.send_email_verification
    during_request: list[int] = []

    async def slow_send(to: str, verify_link: str) -> None:
        during_request.append(1)
        time.sleep(0.2)
        await original(to=to, verify_link=verify_link)

    monkeypatch.setattr(mock_email, "send_email_verification", slow_send)
    from src.auth.commands.resend_verification import (
        ResendVerificationCommand,
    )

    started = time.perf_counter()
    user_id = await app.state.mediator.send(ResendVerificationCommand(email=EMAIL))
    elapsed = time.perf_counter() - started

    assert user_id is not None
    assert during_request == []
    assert elapsed < 0.2


# --- rate limiting on login / register ---


async def test_login_rate_limited_same_shape_for_known_and_unknown(client, mock_email):
    await register_verify_and_login(client, mock_email, "known@example.com")

    for email in ("known@example.com", "ghost@example.com"):
        last = None
        for _ in range(settings.login_rate_limit_max_attempts + 1):
            last = await _login(client, email=email, password="wrongpassword123")
        assert last.status_code == 429
        assert last.json() == {"detail": "Too many login attempts, please try again later"}


async def test_login_throttle_is_keyed_by_ip_and_email(client, mock_email):
    """A flood from one address must not lock the real owner out from another."""
    await register_verify_and_login(client, mock_email, "victim@example.com")
    attacker = {"X-Forwarded-For": "203.0.113.9"}
    for _ in range(settings.login_rate_limit_max_attempts + 1):
        await client.post(
            LOGIN,
            json={"email": "victim@example.com", "password": "wrongpassword123"},
            headers=attacker,
        )

    owner = await client.post(
        LOGIN,
        json={"email": "victim@example.com", "password": DEFAULT_PASSWORD},
        headers={"X-Forwarded-For": "198.51.100.7"},
    )

    assert owner.status_code == 200


async def test_register_rate_limited_per_ip(client):
    headers = {"X-Forwarded-For": "203.0.113.50"}
    for i in range(settings.register_rate_limit_max_attempts):
        resp = await client.post(
            REGISTER, json=make_register_body(email=f"r{i}@example.com"), headers=headers
        )
        assert resp.status_code == 201

    blocked = await client.post(
        REGISTER, json=make_register_body(email="over@example.com"), headers=headers
    )
    other_ip = await client.post(
        REGISTER,
        json=make_register_body(email="other@example.com"),
        headers={"X-Forwarded-For": "198.51.100.1"},
    )

    assert blocked.status_code == 429
    assert other_ip.status_code == 201


# --- session gate on refresh and /me ---


async def test_refresh_and_me_refuse_a_user_who_is_no_longer_active(client, mock_email, mock_db):
    tokens = await register_verify_and_login(client, mock_email, "demoted@example.com")
    await mock_db["users"].update_one(
        {"email": "demoted@example.com"}, {"$set": {"status": "pending_verification"}}
    )

    me = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    refresh = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )

    assert me.status_code == 403
    assert me.json()["code"] == "email_not_verified"
    assert refresh.status_code == 403


# --- password policy on register ---


async def test_register_refuses_a_common_password_with_a_code(client, mock_db):
    resp = await client.post(
        REGISTER, json=make_register_body(email="weak@example.com", password="passwordpassword")
    )

    assert resp.status_code == 422
    assert resp.json() == {
        "detail": "This password is too common. Choose a less predictable one.",
        "code": "weak_password",
    }
    assert await mock_db["users"].count_documents({}) == 0


async def test_register_refuses_a_password_containing_the_users_name_or_email(client):
    by_name = await client.post(
        REGISTER,
        json=make_register_body(
            email="named@example.com",
            first_name="Ada",
            last_name="Lovelace",
            password="my-lovelace-harbour",
        ),
    )
    by_email = await client.post(
        REGISTER,
        json=make_register_body(email="seeker.one@example.com", password="plum-seeker.one-42"),
    )

    for resp in (by_name, by_email):
        assert resp.status_code == 422
        assert resp.json()["code"] == "weak_password"
        assert resp.json()["detail"] == "Password must not contain your name or email address"


async def test_register_refuses_an_eleven_character_password(client):
    resp = await client.post(
        REGISTER, json=make_register_body(email="short@example.com", password="k7#vQ2m!x9p")
    )
    assert resp.status_code == 422
