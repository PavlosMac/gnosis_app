import asyncio
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from openai import AsyncOpenAI

from src.auth.commands.register_user import RegisterUserCommand, RegisterUserHandler
from src.auth.queries.get_user_by_email import GetUserByEmailHandler, GetUserByEmailQuery
from src.auth.queries.get_user_by_id import GetUserByIdHandler, GetUserByIdQuery
from src.auth.repository import AuthReadRepository, AuthWriteRepository, RefreshTokenRepository
from src.auth.router import router as auth_router
from src.core.config import settings
from src.core.exceptions import AppError, app_exception_handler, unhandled_exception_handler
from src.core.logging import configure_logging
from src.core.middleware import AccessLogMiddleware, RequestIDMiddleware
from src.cqrs.mediator import Mediator
from src.database.mongodb import close_mongo_connection, connect_to_mongo, get_database
from src.health.router import router as health_router
from src.llm.openai_adapter import OpenAIAdapter
from src.llm.router import router as llm_router
from src.users.queries.list_users import ListUsersHandler, ListUsersQuery
from src.users.router import router as users_router

configure_logging()

logger = structlog.stdlib.get_logger(__name__)


def _wire_mediator(mediator: Mediator) -> None:
    db = get_database()

    user_write_repo = AuthWriteRepository(db)
    user_read_repo = AuthReadRepository(db)

    mediator.register_command(
        RegisterUserCommand, RegisterUserHandler(user_write_repo, user_read_repo)
    )
    mediator.register_query(GetUserByIdQuery, GetUserByIdHandler(user_read_repo))
    mediator.register_query(GetUserByEmailQuery, GetUserByEmailHandler(user_read_repo))
    mediator.register_query(ListUsersQuery, ListUsersHandler(user_read_repo))


async def _ensure_indexes() -> None:
    db = get_database()
    await asyncio.gather(
        AuthWriteRepository(db).ensure_indexes(),
        RefreshTokenRepository(db).ensure_indexes(),
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("starting up", app=settings.app_name, env=settings.app_env)
    await connect_to_mongo()

    mediator = Mediator()
    _wire_mediator(mediator)
    app.state.mediator = mediator
    app.state.refresh_token_repo = RefreshTokenRepository(get_database())

    openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
    llm_adapter = OpenAIAdapter(
        client=openai_client,
        model=settings.openai_model,
        max_tokens=settings.openai_max_tokens,
    )
    app.state.llm = llm_adapter
    logger.info("llm adapter initialised", model=settings.openai_model)

    await _ensure_indexes()
    logger.info("startup complete")

    yield

    logger.info("shutting down")
    await llm_adapter.close()
    await close_mongo_connection()


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(AccessLogMiddleware)
app.add_middleware(RequestIDMiddleware)
app.add_exception_handler(AppError, app_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(llm_router, prefix="/api/v1")
