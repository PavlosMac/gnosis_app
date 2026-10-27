from datetime import datetime
from typing import Annotated, Self

from pydantic import AfterValidator, EmailStr, Field, model_validator

from src.auth.models import UserStatus
from src.core.base_schema import AppSchema
from src.core.password_policy import MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH
from src.core.types import PyObjectId


def _normalize_email(value: str) -> str:
    return value.strip().lower()


# Emails are stored and looked up lower-cased, so every inbound address is folded at
# the edge — "A@x.com" and "a@x.com" are one account.
NormalizedEmail = Annotated[EmailStr, AfterValidator(_normalize_email)]


def _reject_unencodable(value: str) -> str:
    # JSON allows a lone surrogate ("\ud800") that Python keeps in the str but cannot
    # encode; hashing it raises UnicodeEncodeError, which would surface as a 500.
    try:
        value.encode("utf-8")
    except UnicodeEncodeError:
        raise ValueError("Password contains characters that cannot be stored") from None
    return value


# Every password field uses this, so no request can reach the hasher with text it
# cannot encode.
Password = Annotated[str, AfterValidator(_reject_unencodable)]

# A legal-document version is the dated MDX filename the frontend owns ("2026-09-30").
# The backend stores whatever string it receives — no version validation here, so a
# document edit needs no backend deploy.
ConsentVersion = Annotated[str, Field(min_length=1, max_length=32)]


def _strip_person_name(value: str) -> str:
    # min_length checks the raw string, so a whitespace-only name ("   ") would
    # otherwise pass and leave the account with a blank display_name.
    stripped = value.strip()
    if not stripped:
        raise ValueError("must not be blank")
    return stripped


PersonName = Annotated[str, Field(max_length=100), AfterValidator(_strip_person_name)]


class ConsentVersions(AppSchema):
    terms: ConsentVersion
    privacy: ConsentVersion


class ConsentRecord(AppSchema):
    version: str
    accepted_at: datetime


class ConsentRequest(AppSchema):
    terms: ConsentVersion | None = None
    privacy: ConsentVersion | None = None

    @model_validator(mode="after")
    def _at_least_one_document(self) -> Self:
        if self.terms is None and self.privacy is None:
            raise ValueError("At least one of 'terms' or 'privacy' is required")
        return self


class RegisterRequest(AppSchema):
    email: NormalizedEmail
    password: Password = Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH)
    first_name: PersonName
    last_name: PersonName
    consents: ConsentVersions


class RegisterResponse(AppSchema):
    detail: str = "Account created. Check your email to confirm your address."


class VerifyEmailRequest(AppSchema):
    token: str = Field(min_length=1)


class VerifyEmailResponse(AppSchema):
    detail: str = "Email confirmed. You can now sign in."


class ResendVerificationRequest(AppSchema):
    email: NormalizedEmail


class ResendVerificationResponse(AppSchema):
    detail: str = "If this account is awaiting confirmation, a new link has been sent."


class InviteLookupResponse(AppSchema):
    email: str


class AcceptInviteRequest(AppSchema):
    token: str = Field(min_length=1)
    password: Password = Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH)
    first_name: PersonName
    last_name: PersonName
    consents: ConsentVersions


class AcceptInviteResponse(AppSchema):
    detail: str = "Your account is ready. You can now sign in."


class LoginRequest(AppSchema):
    email: NormalizedEmail
    # Capped like a new password so a giant body never reaches the hasher, but with no
    # minimum: accounts created under the older 8-character rule must still sign in.
    password: Password = Field(max_length=MAX_PASSWORD_LENGTH)


class TokenResponse(AppSchema):
    access_token: str
    refresh_token: str
    access_token_expires_at: int
    refresh_token_expires_at: int
    token_type: str = "bearer"


class RefreshTokenRequest(AppSchema):
    refresh_token: str


class UserResponse(AppSchema):
    id: PyObjectId = Field(alias="_id")
    email: str
    display_name: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    # Always present ({} for legacy users) — the frontend reads an absent key as
    # "backend predates consent" and skips its re-consent gate.
    consents: dict[str, ConsentRecord] = Field(default_factory=dict)
    # "active" when the stored document has no status (pre-verification accounts).
    status: UserStatus = UserStatus.ACTIVE
    email_verified_at: datetime | None = None
    credits: int = 0
    is_superadmin: bool = False
    created_at: datetime
    updated_at: datetime


class UserIdentity(AppSchema):
    """The identity fields every user-facing read of the users collection shares —
    consumers that need only these (e.g. the dashboard) render this model directly, so
    a field change here propagates everywhere at once."""

    id: PyObjectId = Field(alias="_id")
    email: str
    display_name: str | None = None
    is_superadmin: bool = False
    created_at: datetime


class UserReadModel(UserIdentity):
    first_name: str | None = None
    last_name: str | None = None
    consents: dict[str, ConsentRecord] = Field(default_factory=dict)
    status: UserStatus = UserStatus.ACTIVE
    email_verified_at: datetime | None = None
    credits: int = 0
    stripe_customer_id: str | None = None
    updated_at: datetime


class DeleteAccountRequest(AppSchema):
    # Re-authentication for an irreversible action. Identity is the JWT's, never the body's.
    password: Password = Field(min_length=1, max_length=MAX_PASSWORD_LENGTH)


class PasswordResetRequestRequest(AppSchema):
    email: NormalizedEmail


class PasswordResetRequestResponse(AppSchema):
    detail: str = "If an account exists for this email, a password reset link has been sent."


class PasswordResetConfirmRequest(AppSchema):
    token: str = Field(min_length=1)
    new_password: Password = Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH)


class PasswordResetConfirmResponse(AppSchema):
    detail: str = "Password has been reset successfully."
