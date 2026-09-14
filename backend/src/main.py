from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from motor.motor_asyncio import AsyncIOMotorDatabase
from openai import AsyncOpenAI

from src.auth.commands.confirm_password_reset import (
    ConfirmPasswordResetCommand,
    ConfirmPasswordResetHandler,
)
from src.auth.commands.register_user import RegisterUserCommand, RegisterUserHandler
from src.auth.commands.request_password_reset import (
    RequestPasswordResetCommand,
    RequestPasswordResetHandler,
)
from src.auth.queries.get_user_by_email import GetUserByEmailHandler, GetUserByEmailQuery
from src.auth.queries.get_user_by_id import GetUserByIdHandler, GetUserByIdQuery
from src.auth.repository import (
    AuthReadRepository,
    AuthWriteRepository,
    PasswordResetThrottleRepository,
    PasswordResetTokenRepository,
    RefreshTokenRepository,
)
from src.auth.router import router as auth_router
from src.core.config import settings
from src.core.exceptions import (
    AppError,
    app_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from src.core.logging import configure_logging
from src.core.middleware import AccessLogMiddleware, RequestIDMiddleware
from src.cqrs.mediator import Mediator
from src.dashboard.queries.get_dashboard_by_user_id import (
    GetDashboardByUserIdHandler,
    GetDashboardByUserIdQuery,
)
from src.dashboard.router import router as dashboard_router
from src.database.mongodb import close_mongo_connection, connect_to_mongo, get_database
from src.health.router import router as health_router
from src.interpretations.commands.generate_interpretation import (
    GenerateInterpretationCommand,
    GenerateInterpretationHandler,
)
from src.interpretations.repository import (
    InterpretationReadRepository,
    InterpretationWriteRepository,
)
from src.interpretations.router import router as interpretations_router
from src.llm.openai_adapter import OpenAIAdapter
from src.llm.port import LLMPort
from src.llm.router import router as llm_router
from src.migrations.runner import run_migrations
from src.notifications.port import EmailPort
from src.notifications.resend_adapter import ResendEmailAdapter
from src.readings.commands.create_reading import CreateReadingCommand, CreateReadingHandler
from src.readings.commands.update_reading_tags import (
    UpdateReadingTagsCommand,
    UpdateReadingTagsHandler,
)
from src.readings.queries.get_reading_by_id import GetReadingByIdHandler, GetReadingByIdQuery
from src.readings.queries.list_user_readings import ListUserReadingsHandler, ListUserReadingsQuery
from src.readings.repository import (
    ReadingReadRepository,
    ReadingWriteRepository,
    UserTagsReadRepository,
    UserTagsWriteRepository,
)
from src.readings.router import router as readings_router
from src.users.queries.list_users import ListUsersHandler, ListUsersQuery
from src.users.router import router as users_router

configure_logging()

logger = structlog.stdlib.get_logger(__name__)


def _wire_mediator(
    mediator: Mediator, llm: LLMPort, email: EmailPort, db: AsyncIOMotorDatabase
) -> None:
    """Single owner of all handler registrations — tests wire their mediator through
    this too, so a handler registered here is registered everywhere."""
    user_write_repo = AuthWriteRepository(db)
    user_read_repo = AuthReadRepository(db)

    mediator.register_command(
        RegisterUserCommand, RegisterUserHandler(user_write_repo, user_read_repo)
    )
    mediator.register_query(GetUserByIdQuery, GetUserByIdHandler(user_read_repo))
    mediator.register_query(GetUserByEmailQuery, GetUserByEmailHandler(user_read_repo))
    mediator.register_query(ListUsersQuery, ListUsersHandler(user_read_repo))

    reset_token_repo = PasswordResetTokenRepository(db)
    reset_throttle_repo = PasswordResetThrottleRepository(db)
    # Fresh instance is fine — a stateless wrapper around db[collection], same as the
    # one lifespan() puts on app.state.
    refresh_token_repo = RefreshTokenRepository(db)
    mediator.register_command(
        RequestPasswordResetCommand,
        RequestPasswordResetHandler(user_read_repo, reset_token_repo, reset_throttle_repo, email),
    )
    mediator.register_command(
        ConfirmPasswordResetCommand,
        ConfirmPasswordResetHandler(user_write_repo, reset_token_repo, refresh_token_repo),
    )

    reading_write_repo = ReadingWriteRepository(db)
    reading_read_repo = ReadingReadRepository(db)
    user_tags_write_repo = UserTagsWriteRepository(db)
    user_tags_read_repo = UserTagsReadRepository(db)
    interpretation_write_repo = InterpretationWriteRepository(db)
    interpretation_read_repo = InterpretationReadRepository(db)

    mediator.register_command(CreateReadingCommand, CreateReadingHandler(reading_write_repo))
    mediator.register_command(
        UpdateReadingTagsCommand,
        UpdateReadingTagsHandler(reading_write_repo, reading_read_repo, user_tags_write_repo),
    )
    mediator.register_query(
        GetReadingByIdQuery, GetReadingByIdHandler(reading_read_repo, interpretation_read_repo)
    )
    mediator.register_query(
        ListUserReadingsQuery, ListUserReadingsHandler(reading_read_repo, user_tags_read_repo)
    )
    mediator.register_query(
        GetDashboardByUserIdQuery,
        GetDashboardByUserIdHandler(
            user_read_repo, reading_read_repo, user_tags_read_repo, interpretation_read_repo
        ),
    )
    mediator.register_command(
        GenerateInterpretationCommand,
        GenerateInterpretationHandler(
            reading_read_repo,
            user_read_repo,
            user_write_repo,
            interpretation_read_repo,
            interpretation_write_repo,
            llm,
        ),
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("starting up", app=settings.app_name, env=settings.app_env)
    await connect_to_mongo()
    await run_migrations(get_database())

    app.state.refresh_token_repo = RefreshTokenRepository(get_database())
    if settings.openai_api_key:
        openai_client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            max_retries=settings.openai_max_retries,
        )
        llm_adapter = OpenAIAdapter(
            client=openai_client,
            model=settings.openai_model,
            max_tokens=settings.openai_max_tokens,
            reasoning_effort=settings.openai_reasoning_effort,
            max_concurrent=settings.openai_max_concurrent,
            timeout=settings.openai_timeout_seconds,
            acquire_timeout=settings.openai_acquire_timeout_seconds,
        )
        logger.info("llm adapter initialised", adapter="openai", model=settings.openai_model)
    else:
        from src.llm.mock_adapter import MockLLMAdapter

        llm_adapter = MockLLMAdapter()
        logger.info("llm adapter initialised", adapter="mock")
    app.state.llm = llm_adapter

    if settings.resend_api_key:
        email_adapter: EmailPort = ResendEmailAdapter(
            api_key=settings.resend_api_key, from_address=settings.email_from
        )
        logger.info("email adapter initialised", adapter="resend")
    else:
        from src.notifications.console_adapter import ConsoleEmailAdapter

        email_adapter = ConsoleEmailAdapter()
        logger.info("email adapter initialised", adapter="console")
    app.state.email = email_adapter

    mediator = Mediator()
    _wire_mediator(mediator, llm_adapter, email_adapter, get_database())
    app.state.mediator = mediator

    logger.info("startup complete")

    yield

    logger.info("shutting down")
    await llm_adapter.close()
    await email_adapter.close()
    await close_mongo_connection()


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(AccessLogMiddleware)
app.add_middleware(RequestIDMiddleware)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(AppError, app_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(llm_router, prefix="/api/v1")
app.include_router(readings_router, prefix="/api/v1")
app.include_router(interpretations_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
