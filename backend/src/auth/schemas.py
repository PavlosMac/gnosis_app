from datetime import datetime

from pydantic import EmailStr, Field

from src.core.base_schema import AppSchema
from src.core.types import PyObjectId


class RegisterRequest(AppSchema):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=100)


class LoginRequest(AppSchema):
    email: EmailStr
    password: str


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
    credits: int = 0
    is_superadmin: bool = False
    created_at: datetime
    updated_at: datetime


class AdminUserResponse(AppSchema):
    id: PyObjectId = Field(alias="_id")
    email: str
    display_name: str | None = None
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
    credits: int = 0
    stripe_customer_id: str | None = None
    updated_at: datetime
