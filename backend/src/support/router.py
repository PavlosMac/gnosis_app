from fastapi import APIRouter

from src.core.dependencies import CurrentUser, MediatorDep
from src.support.commands.contact_support import ContactSupportCommand
from src.support.schemas import ContactSupportRequest, ContactSupportResponse

router = APIRouter(prefix="/support", tags=["support"])


@router.post("/contact", response_model=ContactSupportResponse)
async def contact_support(
    body: ContactSupportRequest, current_user: CurrentUser, mediator: MediatorDep
) -> ContactSupportResponse:
    # Identity comes from the JWT-resolved user, never from the body, so every
    # ticket is attributable and cannot be forged.
    await mediator.send(
        ContactSupportCommand(
            user_id=str(current_user.id),
            user_email=current_user.email,
            subject=body.subject,
            message=body.message,
        )
    )
    return ContactSupportResponse()
