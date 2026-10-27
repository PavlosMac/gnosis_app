from datetime import datetime

from pydantic import Field

from src.auth.models import UserStatus
from src.auth.schemas import NormalizedEmail
from src.core.base_schema import AppSchema
from src.core.types import PyObjectId


class AdminUserResponse(AppSchema):
    id: PyObjectId = Field(alias="_id")
    email: str
    display_name: str | None = None
    status: UserStatus = UserStatus.ACTIVE
    credits: int = 0
    is_superadmin: bool = False
    created_at: datetime
    updated_at: datetime


class InviteRequest(AppSchema):
    email: NormalizedEmail


class InviteResponse(AppSchema):
    detail: str = "Invitation sent"


class AdminMessageRequest(AppSchema):
    subject: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=5000)


class AdminMessageResponse(AppSchema):
    detail: str = "Email sent"
