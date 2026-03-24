from datetime import datetime

from pydantic import Field

from src.core.base_schema import AppSchema
from src.core.types import PyObjectId


class UserReadModel(AppSchema):
    id: PyObjectId = Field(alias="_id")
    email: str
    display_name: str | None = None
    credits: int = 0
    stripe_customer_id: str | None = None
    created_at: datetime
    updated_at: datetime
