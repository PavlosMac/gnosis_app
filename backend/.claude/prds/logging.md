---
feature: Structured Application Logging
slug: logging
created: 2026-03-24
status: draft
---

# PRD: Structured Application Logging

## Overview

Add structured logging to the Gnosis Esoterica backend using structlog + Python stdlib bridge. JSON output for production, colored console for development. Covers access logging, error logging, CQRS dispatch logging, and lifecycle events. No over-engineering — one new file, four modified files, one new dependency.

## Discovery

### Codebase Patterns

- `src/core/config.py:4-23` — `Settings` uses pydantic-settings with flat fields. New `log_level` and `log_json` fields follow the same pattern.
- `src/core/middleware.py:8-14` — `RequestIDMiddleware` uses `BaseHTTPMiddleware`. Access log middleware uses raw ASGI instead for cleaner status code capture and no body buffering.
- `src/core/exceptions.py:31-35` — `app_exception_handler` is an async function returning `JSONResponse`. Logger calls slot in alongside the existing return.
- `src/main.py:38-51` — `lifespan` async context manager owns startup/shutdown. Lifecycle log calls belong there.
- `src/cqrs/mediator.py:22-32` — `send` and `query` are the only two dispatch points, identical shape, trivial to instrument.
- Zero logging exists currently. No `import logging`, no `print()`, no third-party logging library.
- `RequestIDMiddleware` sets `X-Request-ID` header but is not used in logs (by design).

### Research Findings

- structlog + stdlib bridge via `ProcessorFormatter` is the canonical pattern for FastAPI ([structlog docs](https://www.structlog.org/en/stable/standard-library.html))
- Raw ASGI middleware preferred over `BaseHTTPMiddleware` for contextvars safety and status code capture ([FastAPI Discussion #8632](https://github.com/fastapi/fastapi/discussions/8632))
- `uvicorn.access` should be silenced when custom access logging replaces it ([nymous gist](https://gist.github.com/nymous/f138c7f06062b7c43c060bf03759c29e))
- `cache_logger_on_first_use=True` is safe when no per-request contextvars are bound ([structlog Performance](https://www.structlog.org/en/stable/performance.html))

## Requirements

### Functional Requirements

#### Must Have

- `src/core/logging.py` with `configure_logging()` — structlog + stdlib bridge
- JSON renderer for production, `ConsoleRenderer` for development (driven by `settings.log_json`)
- `log_level: str = "INFO"` and `log_json: bool = False` on `Settings`
- Raw ASGI `AccessLogMiddleware` — logs method, path, status_code, client IP per request
- Error logging in `app_exception_handler` — WARNING for 4xx, ERROR for 5xx
- Fallback `unhandled_exception_handler` for bare `Exception` — ERROR with traceback
- Uvicorn log capture — route `uvicorn`/`uvicorn.error` through structlog, silence `uvicorn.access`
- Lifecycle logging — startup/shutdown events in lifespan
- Module-level `structlog.stdlib.get_logger()` usage pattern

#### Should Have

- CQRS mediator logging — command/query type name at INFO, non-AppError exceptions at ERROR
- Health check (`/api/v1/health`) filtered from access logs
- Sensitive data never logged (Authorization headers, passwords, JWT secrets)

#### Won't Have (This Release)

- Correlation IDs / request_id in log entries
- Request duration tracking
- Audit logging persisted to database
- Distributed tracing / OpenTelemetry
- External log shipping (Datadog, CloudWatch)
- Request/response body logging
- Log rotation (stdout-only, container-friendly)

### Non-Functional Requirements

- **Performance**: No measurable latency impact. `make_filtering_bound_logger` or `cache_logger_on_first_use=True` for fast level filtering.
- **Security**: Never log tokens, passwords, or PII.
- **Testability**: Logging must be reconfigurable between tests.

### Edge Cases

- Uvicorn installs its own handlers before lifespan runs — `configure_logging()` must replace them (`root_logger.handlers = [handler]`)
- Mediator `AppError` vs unexpected `Exception` — split except clauses to avoid double-logging
- Health check path filter is exact match (`/api/v1/health`)

### Acceptance Criteria

- [ ] All HTTP requests (except health) produce structured log entries with method, path, status_code, client
- [ ] `AppError` subclasses are logged at WARNING (4xx) or ERROR (5xx) with status_code and detail
- [ ] Unhandled exceptions produce ERROR-level logs with full traceback
- [ ] `LOG_LEVEL` environment variable controls output verbosity
- [ ] Development shows colored console output; production shows JSON lines
- [ ] Uvicorn startup/shutdown messages flow through the structured pipeline
- [ ] Health check endpoint does NOT produce access log entries
- [ ] No sensitive data appears in any log output
- [ ] Existing tests continue to pass

## Architecture

### High-Level Design

1 new file, 4 modified files, 1 new dependency (`structlog>=24.4.0`).

```
Request -> AccessLogMiddleware (raw ASGI) -> RequestIDMiddleware -> Router -> Mediator -> Handler
                                                                                |
                                                                      AppError -> app_exception_handler (WARNING/ERROR)
                                                                      Exception -> unhandled_exception_handler (ERROR + traceback)
                                                                                |
AccessLogMiddleware logs: method, path, status_code, client         <- Response
```

### Key Decisions

- **Raw ASGI middleware** for access logging: Cleaner than `BaseHTTPMiddleware` — captures status code via `send_wrapper`, no body buffering, no contextvars issues.
- **No double-logging**: Mediator splits `except AppError: raise` (let exception handler log it) from `except Exception: logger.exception(); raise`.
- **Module-level loggers**: `structlog.stdlib.get_logger(__name__)` at module level. No DI injection, no wrapper classes.
- **`configure_logging()` at module top of `main.py`**: Runs before any logger binds its processor chain.

### Integration Points

- `src/core/logging.py` — called once from `main.py` at import time
- `src/core/middleware.py` — `AccessLogMiddleware` registered in `main.py`
- `src/core/exceptions.py` — `unhandled_exception_handler` registered in `main.py`
- `src/cqrs/mediator.py` — imports `AppError` from `src.core.exceptions` for the except split

### Files to Create/Modify

| File | Action | Description |
|---|---|---|
| `src/core/logging.py` | **Create** | `configure_logging()` — structlog + stdlib bridge, renderer selection, uvicorn log routing |
| `src/core/config.py` | Modify | Add `log_level: str = "INFO"` and `log_json: bool = False` to `Settings` |
| `src/core/middleware.py` | Modify | Add `AccessLogMiddleware` (raw ASGI) below existing `RequestIDMiddleware` |
| `src/core/exceptions.py` | Modify | Add logger to `app_exception_handler`, add `unhandled_exception_handler` |
| `src/cqrs/mediator.py` | Modify | Add logger, instrument `send`/`query` with AppError-aware try/except |
| `src/main.py` | Modify | Import + call `configure_logging()`, register middleware + exception handler, add lifecycle logs |
| `pyproject.toml` | Modify | Add `structlog>=24.4.0` dependency |

### Build Sequence

1. `uv add structlog` — add dependency
2. Create `src/core/logging.py`
3. Edit `src/core/config.py` — add log settings
4. Edit `src/core/exceptions.py` — add error logging + fallback handler
5. Edit `src/core/middleware.py` — add `AccessLogMiddleware`
6. Edit `src/cqrs/mediator.py` — add dispatch logging
7. Edit `src/main.py` — wire everything together
8. Smoke test

## References

- [structlog Standard Library Integration](https://www.structlog.org/en/stable/standard-library.html)
- [structlog Performance](https://www.structlog.org/en/stable/performance.html)
- [nymous: FastAPI + Uvicorn + structlog setup](https://gist.github.com/nymous/f138c7f06062b7c43c060bf03759c29e)
- [FastAPI Discussion #8632: BaseHTTPMiddleware and contextvars](https://github.com/fastapi/fastapi/discussions/8632)
- [wazaari.dev: Integrating FastAPI with Structlog](https://wazaari.dev/blog/fastapi-structlog-integration)
