# Gnosis Esoterica Backend

## Overview
Tarot reading API backend with user signup and AI-powered interpretations. Built with FastAPI, async MongoDB (Motor), and a CQRS/Mediator architecture.


## Tech Stack
- **Language**: Python 3.12 (uv package manager)
- **Framework**: FastAPI + Uvicorn
- **Database**: MongoDB via Motor (async driver) @model_references
- **Auth**: PyJWT (HS256) + pwdlib[argon2]
- **Validation**: Pydantic v2 + pydantic-settings
- **Testing**: pytest-asyncio + httpx + mongomock-motor
- **Linting**: Ruff (line length 100, rules: E, F, I, N, W, UP; UP046 ignored)

## Development Commands
```bash
make install        # uv sync
make dev            # native fallback: uvicorn --reload on :8000, needs compose Mongo up (localhost:27019). Normal path is root `make dev`
make test           # pytest -v
make lint           # ruff check src/ tests/ scripts/
make typecheck      # pyright src/ scripts/
make format         # ruff format + ruff check --fix
make docker-up      # docker compose up — foreground (project `gnosis`: MongoDB:27019 + API:8001, seeds dev superadmin)
make docker-down    # docker compose down
make migrate        # run pending DB migrations
make docker-prod-up    # docker compose -f docker-compose.prod.yml up -d
make docker-prod-down  # docker compose -f docker-compose.prod.yml down
make prompt-doc     # regenerate the generated regions of docs/prompts/prompt_reference.md
make prompt-doc-check  # exit 1 if docs/prompts/prompt_reference.md is stale
```

## Architecture
Layered with CQRS (Mediator pattern). Dependency flow is strictly top-down:

```
Routers → Application (CQRS handlers, services) → Domain (models) → Infrastructure (database, security, config)
```

### Domain Folder Structure
Each domain contains only these files — keep it lean:
```
src/<domain>/
├── router.py       # Endpoints
├── service.py      # Business logic + domain-specific exceptions
├── schemas.py      # Pydantic request/response schemas + read models
├── repository.py   # Write + Read repository implementations
├── models.py       # Plain Python domain model (to_document/from_document)
├── commands/       # CQRS command + handler pairs (one file each)
└── queries/        # CQRS query + handler pairs (one file each)
```
Domain-specific dependencies go in `src/core/dependencies.py`. Domain-specific exceptions are co-located in `service.py`. Collection name constants go in `src/database/collections/constants.py`.

Example with CQRS directories expanded (auth is the reference domain):
```
src/auth/commands/register_user.py   # RegisterUserCommand + RegisterUserHandler in ONE file
src/auth/queries/get_user_by_id.py   # GetUserByIdQuery + GetUserByIdHandler in ONE file
```

### Structural Rules
- ❌ Business logic in `router.py` — routers are thin, delegate to mediator or service
- ❌ Split command and handler into separate files — always co-locate
- ❌ Create a handler without registering it in mediator wiring (`main.py`)
- ❌ Import repository directly in a router
- ❌ Use `HTTPException` — use `AppError` hierarchy
- ❌ Create new dep factories outside `src/core/dependencies.py`

### Cross-Cutting (`src/core/`)
- `config.py` — Settings via pydantic-settings
- `dependencies.py` — All `Annotated` FastAPI deps (core + domain)
- `exceptions.py` — `AppError` hierarchy + global exception handler
- `base_schema.py` — `AppSchema` base for all API schemas
- `security.py` — Password hashing, JWT creation/decode
- `pagination.py` — `PaginationParams` + `PaginatedResponse[T]`
- `types.py` — `PyObjectId` (BSON ObjectId ↔ str)
- `middleware.py` — `RequestIDMiddleware` + `AccessLogMiddleware`

### CQRS Pattern
- **Commands**: `BaseCommand` (frozen Pydantic) → `CommandHandler` — return scalars
- **Queries**: `BaseQuery` (frozen Pydantic) → `QueryHandler` — return read models
- **Mediator**: `mediator.send(command)` / `mediator.query(query)` — wired in `main.py`
- Command + handler co-located in one file (e.g. `commands/register_user.py`)
- Mediator wiring in `main.py`: `mediator.register_command(RegisterUserCommand, RegisterUserHandler(deps))` — add both command and query registrations when creating new handlers


### Repository Pattern
- Split `BaseWriteRepository` / `BaseReadRepository` ABCs in `src/database/base_repository.py`
- Repos return raw `dict[str, Any]` — handlers convert via `model_validate()`
- Index management via migrations (not repositories)

### Domain Models
- Plain Python classes (not Pydantic) with `to_document()` / `from_document()`
- Optional fields omitted from documents (not stored as null)
- Separate Pydantic read models in `schemas.py` for query responses

### Migrations
- Single owner of all schema changes (indexes, collection setup, data transforms)
- Files in `src/migrations/versions/` — naming: `NNN_snake_case.py` (zero-padded 3-digit prefix)
- Each file exports: `version: str`, `description: str`, `async def up(db: AsyncIOMotorDatabase) -> None`
- `version` attribute must match the filename prefix (e.g. file `002_foo.py` → `version = "002"`)
- Forward-only — no `down()` migrations
- `up()` must be idempotent (safe to re-run even if runner skips applied versions)
- Reference collections via constants from `src/database/collections/constants.py`
- No application imports (models, services, schemas) — migrations must be self-contained
- One logical concern per migration file
- Runner auto-discovers and sorts by filename; tracked in `_migrations` collection
- See [`docs/database/db_migrations.md`](docs/database/db_migrations.md) for examples and runner details

## Conventions

### Naming
- Exceptions: `Error` suffix (`AppError`, `NotFoundError`, `EmailAlreadyExistsError`)
- Commands: `<Action><Entity>Command` / `<Action><Entity>Handler`
- Queries: `Get<Entity>By<Field>Query` / `Get<Entity>By<Field>Handler`
- Repos: `<Entity>WriteRepository` / `<Entity>ReadRepository`
- Dependencies: `get_<thing>` functions, `PascalCase` for Annotated aliases
- All `__init__.py` files are empty — use fully qualified `src.*` imports

### Error Handling
- All errors through `AppError` hierarchy — never use `HTTPException`
- Domain exceptions inherit from core errors, defined in the service that raises them
- Library exceptions caught and re-raised as domain errors
- Global handler returns `{"detail": exc.detail}`

### Type Annotations
- All functions have explicit return types including `-> None`
- Union syntax: `X | Y` (not `Optional[X]`)
- Generic collections: lowercase `dict[str, Any]`, `list[str]`

### Dependency Injection
- **Services must be injected into routers via FastAPI `Depends`** — never construct services manually in route handlers
- Each service gets an `Annotated` dep alias (e.g. `AuthServiceDep`) in `src/core/dependencies.py`
- Factory pattern: `get_<service>` function composes the service from its dependencies (repos, other deps)
- Routers stay thin — they receive validated input + injected services and delegate all logic

### API
- Prefix: `/api/v1/`
- Routers per domain with `prefix` and `tags`
- Input bodies named `body`, deps named by their type

### Schemas
- All API schemas inherit from `AppSchema` (not raw `BaseModel`)
- Infrastructure types (`BaseCommand`, `BaseQuery`, `PaginationParams`) extend `BaseModel` directly
- `Field(...)` for constraints, `model_validate()` for deserialization

### Logging
- `structlog` via `structlog.stdlib.get_logger(__name__)`; JSON in prod (`LOG_JSON`), console in dev
- Event name is a short lowercase phrase; all data goes in keyword fields — never f-strings or `%` formatting in the message, never `extra=`
- No PII in log fields: no emails, names, tokens, or raw request bodies. `user_id` is acceptable
- Levels: `info` for business events, `warning` for handled `AppError`s and validation failures, `error` only with `exc_info` for unhandled failures, `debug` for payloads

### Change Checklist
Before opening a PR, if the diff touches any of these:
- **New field on an existing collection** → migration to backfill, or every reader tolerates its absence
- **New index** → migration; ships before the code that relies on it
- **New setting** → add to `Settings` in `src/core/config.py` with a default, to `.env.example`, and to `.env.gnosis.prod` on the Pi
- **New dependency** → `uv add` (pinned in `uv.lock`); Docker image needs a rebuild
- **Changed request/response schema** → this API is the contract; check `frontend/` callers and the shared types before merging

### Testing
- `asyncio_mode = "auto"` — no `@pytest.mark.asyncio` needed
- `mongomock-motor` via `set_database()` — autouse fixture, collections dropped after each test
- Unit tests: handler-level (`test_commands.py`) | Integration: HTTP-level (`test_router.py`)
- Test names: `test_<action>_<condition>`
- All fixtures in `tests/conftest.py`

## Key Files
Read these before searching. Grep/Glob for anything not listed here.

### Wiring & infrastructure
- `src/main.py` — App factory, lifespan (runs migrations), router + mediator wiring, picks real vs mock LLM/email adapters from settings
- `src/core/config.py` — All settings (pydantic-settings); env var names live here
- `src/core/dependencies.py` — All injectable FastAPI deps, incl. `LLMDep`, `EmailDep`, `IsSuperAdmin`
- `src/core/exceptions.py` — Error hierarchy + global handler
- `src/cqrs/mediator.py` — Central command/query dispatcher
- `src/database/base_repository.py` — Repository ABCs
- `src/database/mongodb.py` — Connection lifecycle; `set_database()` is the test seam
- `src/database/collections/constants.py` — Every collection name; add new ones here
- `src/migrations/runner.py` — Auto-discovers `versions/NNN_*.py`, tracks applied in `_migrations`

### Ports & adapters
- `src/llm/port.py` — `LLMPort` ABC; `openai_adapter.py` (prod) / `mock_adapter.py` (when `OPENAI_API_KEY` is unset)
- `src/llm/prompt_builder.py` — Prompt templates + token budgeting; regenerate `docs/prompts/prompt_reference.md` (`make prompt-doc`) after editing
- `src/llm/pricing.py` — Per-model price table, `cost_usd()` / `worst_case_cost_usd()`
- `src/notifications/port.py` — `EmailPort` ABC; `resend_adapter.py` (prod) / `console_adapter.py` (when `RESEND_API_KEY` is unset) / `mock_adapter.py` (tests)
- `src/notifications/templates.py` — Password-reset and support-request email copy

### Domains (each follows the folder layout above)
- `src/auth/` — Reference domain: register, login/refresh JWT, password reset
- `src/users/` — Superadmin user listing
- `src/readings/` — Saved readings + user tags
- `src/interpretations/` — AI interpretations of readings; `commands/generate_interpretation.py` is the LLM call site and usage accounting
- `src/dashboard/` — Per-user aggregate read model
- `src/support/` — Contact-support form → email, rate-limited
- `src/health/` — Liveness endpoint
- `src/llm/router.py` — Superadmin-only raw `/llm/interpret` endpoint for prompt testing

### Tests, scripts, docs
- `tests/conftest.py` — Test fixture strategy
- `scripts/seed_superadmin.py` — Seeds the dev superadmin (run by `make docker-up`)
- `scripts/dump_prompts.py` — Backs `make prompt-doc`
- `docs/README.md` — Docs index with Live/Plan/Historical status per doc
- `docs/database/model_references.md` — Current collections, fields, and indexes
