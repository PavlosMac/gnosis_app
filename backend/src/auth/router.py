from fastapi import APIRouter, BackgroundTasks, Request, Response

from src.auth.commands.confirm_password_reset import ConfirmPasswordResetCommand
from src.auth.commands.delete_user import DeleteUserCommand
from src.auth.commands.record_consent import RecordConsentCommand
from src.auth.commands.register_user import RegisterUserCommand
from src.auth.commands.request_password_reset import RequestPasswordResetCommand
from src.auth.commands.resend_verification import ResendVerificationCommand
from src.auth.commands.send_verification_email import SendVerificationEmailCommand
from src.auth.commands.verify_email import VerifyEmailCommand
from src.auth.queries.get_user_by_id import GetUserByIdQuery
from src.auth.schemas import (
    ConsentRequest,
    DeleteAccountRequest,
    LoginRequest,
    PasswordResetConfirmRequest,
    PasswordResetConfirmResponse,
    PasswordResetRequestRequest,
    PasswordResetRequestResponse,
    RefreshTokenRequest,
    RegisterRequest,
    RegisterResponse,
    ResendVerificationRequest,
    ResendVerificationResponse,
    TokenResponse,
    UserResponse,
    VerifyEmailRequest,
    VerifyEmailResponse,
)
from src.core.dependencies import (
    AuthServiceDep,
    ClientIp,
    CurrentUser,
    CurrentUserId,
    MediatorDep,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(
    body: RegisterRequest,
    mediator: MediatorDep,
    client_ip: ClientIp,
    background_tasks: BackgroundTasks,
) -> RegisterResponse:
    """Creates a pending account and mails the verification link. No tokens: a
    session only exists after the address is confirmed and the user logs in.
    The email is sent after the response (see resend_verification below) so a
    slow or down provider never blocks account creation."""
    user_id = await mediator.send(
        RegisterUserCommand(
            email=body.email,
            password=body.password,
            first_name=body.first_name,
            last_name=body.last_name,
            terms_version=body.consents.terms,
            privacy_version=body.consents.privacy,
            client_ip=client_ip,
        )
    )
    background_tasks.add_task(mediator.send, SendVerificationEmailCommand(user_id=user_id))
    return RegisterResponse()


@router.post("/verify-email", response_model=VerifyEmailResponse)
async def verify_email(body: VerifyEmailRequest, mediator: MediatorDep) -> VerifyEmailResponse:
    await mediator.send(VerifyEmailCommand(token=body.token))
    return VerifyEmailResponse()


@router.post("/resend-verification", response_model=ResendVerificationResponse)
async def resend_verification(
    body: ResendVerificationRequest,
    mediator: MediatorDep,
    background_tasks: BackgroundTasks,
) -> ResendVerificationResponse:
    user_id = await mediator.send(ResendVerificationCommand(email=body.email))
    if user_id is not None:
        # After the response: unknown, active and pending then cost the same on the
        # request path, so response time does not reveal which one it was.
        background_tasks.add_task(mediator.send, SendVerificationEmailCommand(user_id=user_id))
    return ResendVerificationResponse()


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, service: AuthServiceDep, client_ip: ClientIp) -> TokenResponse:
    return await service.authenticate(body.email, body.password, client_ip)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshTokenRequest, service: AuthServiceDep) -> TokenResponse:
    return await service.refresh_tokens(body.refresh_token)


@router.post("/logout")
async def logout(
    request: Request,
    user_id: CurrentUserId,
    service: AuthServiceDep,
) -> dict:
    token = request.headers["Authorization"].removeprefix("Bearer ")
    await service.revoke_token(token, user_id)
    return {"detail": "Logged out"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(current_user.model_dump(by_alias=True))


@router.delete("/me", status_code=204)
async def delete_me(
    body: DeleteAccountRequest,
    current_user: CurrentUser,
    service: AuthServiceDep,
    mediator: MediatorDep,
) -> Response:
    """Self-service account deletion: immediate and irreversible. The frontend clears
    its cookies afterwards (this API is bearer-only)."""
    user_id = str(current_user.id)
    await service.confirm_password(user_id, body.password)
    await mediator.send(DeleteUserCommand(user_id=user_id))
    return Response(status_code=204)


@router.post("/consent", response_model=UserResponse)
async def record_consent(
    body: ConsentRequest, user_id: CurrentUserId, current_user: CurrentUser, mediator: MediatorDep
) -> UserResponse:
    await mediator.send(
        RecordConsentCommand(user_id=user_id, terms=body.terms, privacy=body.privacy)
    )
    user = await mediator.query(GetUserByIdQuery(user_id=user_id))
    return UserResponse.model_validate(user.model_dump(by_alias=True))


@router.post("/forgot-password", response_model=PasswordResetRequestResponse)
async def forgot_password(
    body: PasswordResetRequestRequest, mediator: MediatorDep
) -> PasswordResetRequestResponse:
    await mediator.send(RequestPasswordResetCommand(email=body.email))
    return PasswordResetRequestResponse()


@router.post("/reset-password", response_model=PasswordResetConfirmResponse)
async def reset_password(
    body: PasswordResetConfirmRequest, mediator: MediatorDep
) -> PasswordResetConfirmResponse:
    await mediator.send(
        ConfirmPasswordResetCommand(token=body.token, new_password=body.new_password)
    )
    return PasswordResetConfirmResponse()
