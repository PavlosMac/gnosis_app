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
    token_type: str = "bearer"


class RefreshTokenRequest(AppSchema):
    refresh_token: str


class UserResponse(AppSchema):
    id: PyObjectId = Field(alias="_id")
    email: str
    display_name: str | None = None
    credits: int = 0
    created_at: datetime
    updated_at: datetime
