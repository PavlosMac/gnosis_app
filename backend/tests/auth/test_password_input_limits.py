import pytest
from pydantic import ValidationError

from src.auth.schemas import (
    DeleteAccountRequest,
    LoginRequest,
    PasswordResetConfirmRequest,
    RegisterRequest,
)
from src.core.password_policy import MAX_PASSWORD_LENGTH

LONE_SURROGATE = "\ud800"
VALID_REGISTER = {
    "email": "a@example.com",
    "first_name": "Ada",
    "last_name": "Byron",
    "consents": {"terms": "2026-09-30", "privacy": "2026-09-30"},
}


def _login(password: str) -> LoginRequest:
    return LoginRequest(email="a@example.com", password=password)


def test_login_accepts_a_password_at_the_cap():
    _login("x" * MAX_PASSWORD_LENGTH)


def test_login_rejects_a_password_over_the_cap():
    with pytest.raises(ValidationError):
        _login("x" * (MAX_PASSWORD_LENGTH + 1))


def test_delete_account_accepts_a_password_at_the_cap_and_rejects_over_it():
    DeleteAccountRequest(password="x" * MAX_PASSWORD_LENGTH)
    with pytest.raises(ValidationError):
        DeleteAccountRequest(password="x" * (MAX_PASSWORD_LENGTH + 1))


@pytest.mark.parametrize(
    "build",
    [
        lambda p: LoginRequest(email="a@example.com", password=p),
        lambda p: DeleteAccountRequest(password=p),
        lambda p: PasswordResetConfirmRequest(token="t", new_password=p + "x" * 12),
        lambda p: RegisterRequest(password=p + "x" * 12, **VALID_REGISTER),
    ],
    ids=["login", "delete-account", "reset", "register"],
)
def test_every_password_field_rejects_text_that_cannot_be_utf8_encoded(build):
    with pytest.raises(ValidationError):
        build(LONE_SURROGATE)


async def test_login_with_a_lone_surrogate_is_422_not_500(client):
    resp = await client.post(
        "/api/v1/auth/login",
        content=b'{"email": "a@example.com", "password": "\\ud800"}',
        headers={"content-type": "application/json"},
    )

    assert resp.status_code == 422
