import structlog
from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = structlog.stdlib.get_logger(__name__)


class AppError(Exception):
    def __init__(self, status_code: int, detail: str, code: str | None = None):
        self.status_code = status_code
        self.detail = detail
        # Stable machine-readable discriminator for clients that must branch on the
        # error (e.g. "email_not_verified"); absent from the body when unset.
        self.code = code


class NotFoundError(AppError):
    def __init__(self, detail: str = "Resource not found", code: str | None = None):
        super().__init__(status_code=404, detail=detail, code=code)


class ConflictError(AppError):
    def __init__(self, detail: str = "Resource already exists", code: str | None = None):
        super().__init__(status_code=409, detail=detail, code=code)


class UnauthorizedError(AppError):
    def __init__(self, detail: str = "Not authenticated", code: str | None = None):
        super().__init__(status_code=401, detail=detail, code=code)


class ForbiddenError(AppError):
    def __init__(self, detail: str = "Forbidden", code: str | None = None):
        super().__init__(status_code=403, detail=detail, code=code)


class WeakPasswordError(AppError):
    """A new password failed the policy in src/core/password_policy.py. The detail is
    written for the user and is safe to show as-is; clients branch on the code."""

    def __init__(self, detail: str):
        super().__init__(status_code=422, detail=detail, code="weak_password")


async def app_exception_handler(_request: Request, exc: AppError) -> JSONResponse:
    if exc.status_code >= 500:
        logger.error("application error", status_code=exc.status_code, detail=exc.detail)
    else:
        logger.warning("application error", status_code=exc.status_code, detail=exc.detail)
    content: dict[str, str] = {"detail": exc.detail}
    if exc.code is not None:
        content["code"] = exc.code
    return JSONResponse(status_code=exc.status_code, content=content)


async def validation_exception_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    # Pydantic's `input` is the submitted value and `ctx` can embed it: on a login or
    # register body that is a plaintext password, so neither is logged or returned.
    errors = [
        {key: value for key, value in error.items() if key not in ("input", "ctx")}
        for error in exc.errors()
    ]
    logger.warning("request validation error", errors=[(e["loc"], e["type"]) for e in errors])
    return JSONResponse(
        status_code=422,
        content={"detail": jsonable_encoder(errors)},
    )


async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.error("unhandled exception", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
