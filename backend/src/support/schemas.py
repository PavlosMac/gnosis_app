from typing import Annotated

from pydantic import StringConstraints

from src.core.base_schema import AppSchema

# Limits mirror the frontend's contactSupportSchema (SUPPORT_SUBJECT_MAX = 200,
# SUPPORT_MESSAGE_MAX = 5000) — the frontend pins these values; keep them in sync.
SUPPORT_SUBJECT_MAX = 200
SUPPORT_MESSAGE_MAX = 5000


class ContactSupportRequest(AppSchema):
    # Identity is never taken from the body — the router resolves it from the JWT.
    subject: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=3, max_length=SUPPORT_SUBJECT_MAX)
    ]
    message: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=10, max_length=SUPPORT_MESSAGE_MAX),
    ]


class ContactSupportResponse(AppSchema):
    message: str = "Your message has been received."
