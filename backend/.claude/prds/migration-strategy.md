---
feature: MongoDB Auth Init Script + Migration Runner
slug: migration-strategy
created: 2026-04-03
status: draft
---

# PRD: MongoDB Auth Init Script + Migration Runner

## Overview

The project runs MongoDB without authentication in dev. Before first production deploy to the Raspberry Pi, we need: (1) a MongoDB init script that creates a scoped app user, (2) a production docker-compose with auth enabled, and (3) a lightweight migration runner tracked in a `_migrations` collection, called at app startup.

This is a solo developer project — the design prioritises simplicity, idempotency, and reliability over flexibility. No third-party migration libraries; no downgrade support.

## Discovery

### Codebase Patterns

- **DB singleton** (`src/database/mongodb.py`): `connect_to_mongo()`, `get_database()`, `set_database()` (test seam), `close_mongo_connection()`. Module-level globals act as a simple service locator.
- **Lifespan** (`src/main.py:52-78`): `connect_to_mongo()` -> mediator wiring -> `_ensure_indexes()` -> yield -> shutdown. Clear insertion point for migrations between connect and indexes.
- **Existing indexes** (`src/auth/repository.py:15-18, 55-58`): 6 `create_index` calls across `users` and `refresh_tokens`, all idempotent. Called via `_ensure_indexes()` in `main.py:44-49` using `asyncio.gather()`.
- **Collection constants** (`src/database/collections/constants.py`): `USERS_COLLECTION`, `REFRESH_TOKENS_COLLECTION`.
- **Structlog** (`src/main.py:27`): `logger = structlog.stdlib.get_logger(__name__)` with keyword args. `configure_logging()` called at module level in `main.py`.
- **Test setup** (`tests/conftest.py`): autouse `mock_db` fixture using `AsyncMongoMockClient` + `set_database()`, collections dropped after each test. `asyncio_mode = "auto"`.
- **Config** (`src/core/config.py`): `settings.mongodb_uri` and `settings.mongodb_database` via pydantic-settings. `.env.prod.example` already has `MONGO_ROOT_PASSWORD` and `GNOSIS_APP_PASSWORD` placeholders.

### Research Findings

- **`pymongo-migrate`** is the main lightweight Python option but is sync-only (pymongo, not Motor) — unsuitable for this async project.
- **Custom async runner** (~50 lines) is the community-standard approach for FastAPI/Motor projects. No library needed.
- **`docker-entrypoint-initdb.d`** scripts run once on first container start (empty volume only). Good for auth user creation, useless for ongoing schema changes — hence the need for a proper migration runner.
- **`create_index`** is idempotent in MongoDB — safe to call on every startup, no-op if the index exists.
- **Unique index on `_migrations.version`** prevents double-application even under race conditions (two instances starting simultaneously). `DuplicateKeyError` from `pymongo.errors` is the safety net.
- **Record after success**: insert the tracking document only after `up()` completes successfully. If `up()` fails, no record is written, so the migration retries on next startup.
- **Crash on failure**: a failed migration should crash app startup — never silently skip. A partially-applied schema is worse than a visible crash.

## Requirements

### Functional Requirements

#### Must Have

- Migration runner that discovers versioned `.py` files from `src/migrations/versions/`, sorted by filename prefix
- Each migration exports: `version: str`, `description: str`, `async def up(db: AsyncIOMotorDatabase) -> None`
- `_migrations` collection with unique index on `version` — prevents double-application
- Integrated into FastAPI lifespan after `connect_to_mongo()`, before `_ensure_indexes()`
- CLI support: `python -m src.migrations.runner` for manual runs (connects, runs, disconnects)
- First migration (`001_initial_indexes.py`) mirrors existing `ensure_indexes()` calls
- Failed migration crashes startup — exception propagates, no try/except in runner
- `mongo/init-user.js` creates scoped `gnosis_app` user (readWrite on `gnosis_esoterica`) on first prod startup
- `docker-compose.prod.yml` — standalone prod compose: `--auth` flag, no `src/` bind-mount, no `--reload`, `restart: unless-stopped`, `app-network`
- Makefile targets: `make migrate`, `make docker-prod-up`, `make docker-prod-down`
- 4 migration runner tests using existing `mongomock-motor` setup

#### Should Have

- `structlog` logging for each migration applied/skipped
- Tick off completed TODOs in `docs/configure_db.md` (sections 1 and 4)

#### Won't Have (This Release)

- Downgrade/rollback (`down()` functions)
- Checksum validation on migration files
- Migration locking beyond the unique index
- Changes to dev `docker-compose.yml` — dev stays auth-free
- Third-party migration libraries

### Non-Functional Requirements

- **Idempotency**: Safe to re-run on every startup. `create_index` is inherently idempotent. Migration tracking via `_migrations` prevents re-execution. The `_migrations` unique index itself is bootstrapped via `create_index` (idempotent) inside `run_migrations()`.
- **Reliability**: Failed migration crashes startup. No silent skips, no swallowed exceptions.
- **Security**: Pi gets scoped `gnosis_app` user (readWrite only on `gnosis_esoterica`). Root user (`gnosis_admin`) for admin tasks only. Passwords generated with `openssl rand -hex 16`, stored only in `.env.prod` on the Pi — never committed.
- **Simplicity**: ~50 lines for the runner core. No abstractions, no base classes, no framework.

### Edge Cases

- Two app instances starting simultaneously: unique index on `version` handles the race via `DuplicateKeyError`
- Migration fails midway: no record inserted, retries on next startup. Individual migration operations (e.g. `create_index`) are idempotent, so partial re-runs are safe.
- Empty volume on Pi: init script creates user. Existing volume: init script silently skipped (Docker design).
- Migration file added but version already in `_migrations`: skipped (set membership check).

### Acceptance Criteria

- [ ] `make test` passes (all existing + 4 new migration tests)
- [ ] `make lint` passes with no ruff violations
- [ ] `make docker-up` works without auth (dev unchanged)
- [ ] Migration runner applies pending migrations and skips already-applied ones
- [ ] `_migrations` collection has a unique index on `version`
- [ ] `python -m src.migrations.runner` works standalone (CLI)
- [ ] `docker-compose.prod.yml` starts MongoDB with auth and mounts init script
- [ ] `docs/configure_db.md` TODOs are ticked off

## Architecture

### High-Level Design

```
FastAPI startup
    |
    v
connect_to_mongo()                       <-- src/database/mongodb.py
    |
    v
run_migrations(db)                       <-- src/migrations/runner.py
    |-- create_index("version", unique=True) on _migrations   (bootstrap, idempotent)
    |-- find all applied versions from _migrations             (set comprehension)
    |-- discover_migrations()                                  (pathlib + importlib)
    |       \-- sorted *.py files from src/migrations/versions/
    |
    \-- for each pending migration:
            |-- migration.up(db)
            \-- insert {"version", "description", "applied_at"} into _migrations
    |
    v
_wire_mediator(mediator)
    |
    v
_ensure_indexes()                        <-- still runs, idempotent alongside migration indexes
    |
    v
yield (app serves requests)
```

CLI path (`python -m src.migrations.runner`):
```
configure_logging() -> connect_to_mongo() -> run_migrations(db) -> close_mongo_connection()
```

### Key Decisions

- **No try/except in runner**: failed migration crashes startup. Correct for a solo project — visibility over resilience.
- **`_migrations` index bootstrapped inline**: `create_index("version", unique=True)` called every time `run_migrations()` runs. Idempotent, avoids circular "who migrates the tracker" problem.
- **`datetime.now(UTC)` not `utcnow()`**: Python 3.12 deprecates `utcnow()`, consistent with UP ruff rules.
- **4th test is crash-on-failure**: replaced `discover_migrations_sorted` from the strategy doc with `test_run_migrations_crashes_on_failure` — crash behaviour is more critical to verify than filesystem sorting.
- **Standalone prod compose**: not an override file, keeps dev and prod fully isolated with no accidental merging.
- **Migration 001 uses collection constants**: `db[USERS_COLLECTION]` not `db.users` — consistent with the rest of the codebase.

### Integration Points

- `src/main.py` lifespan (line 55): insert `run_migrations()` call after `connect_to_mongo()`
- `src/database/mongodb.py`: runner's `__main__` block reuses `connect_to_mongo()`, `get_database()`, `close_mongo_connection()`
- `src/core/config.py`: runner inherits `settings.mongodb_uri` automatically — no new env vars
- `src/core/logging.py`: CLI entrypoint must call `configure_logging()` explicitly (since `main.py` is not imported)
- `tests/conftest.py`: migration tests use existing `mock_db` autouse fixture via `set_database()`

### Files to Create/Modify

| Action | File | Notes |
|--------|------|-------|
| Create | `src/migrations/__init__.py` | Empty |
| Create | `src/migrations/versions/__init__.py` | Empty |
| Create | `src/migrations/runner.py` | `discover_migrations()`, `run_migrations()`, `__main__` block |
| Create | `src/migrations/versions/001_initial_indexes.py` | Mirrors existing `ensure_indexes()` calls |
| Create | `mongo/init-user.js` | Scoped `gnosis_app` user creation |
| Create | `docker-compose.prod.yml` | Production compose with auth |
| Create | `tests/migrations/__init__.py` | Empty |
| Create | `tests/migrations/test_runner.py` | 4 tests: applies pending, skips applied, order, crash on failure |
| Modify | `src/main.py` | Add import + `await run_migrations(get_database())` in lifespan |
| Modify | `Makefile` | Add `migrate`, `docker-prod-up`, `docker-prod-down` targets |
| Modify | `docs/configure_db.md` | Tick off completed TODOs in sections 1, 4, and 5 |

### Build Sequence

1. **Migration runner core** — `runner.py` + `001_initial_indexes.py` + empty `__init__.py` files
2. **Lifespan integration** — `main.py` import + call
3. **Tests** — 4 test cases, run `make test`
4. **Production auth** — `init-user.js` + `docker-compose.prod.yml`
5. **Makefile + docs** — targets + tick TODOs
6. **Lint check** — `make lint`

## References

- [MongoDB docker-entrypoint-initdb.d docs](https://hub.docker.com/_/mongo) — init script behaviour
- [MongoDB unique indexes](https://www.mongodb.com/docs/manual/core/index-unique/) — idempotency primitive
- [MongoDB SCRAM auth setup](https://www.mongodb.com/docs/manual/tutorial/configure-scram-client-authentication/)
- [Motor asyncio tutorial](https://motor.readthedocs.io/en/stable/tutorial-asyncio.html)
- [FastAPI lifespan events](https://fastapi.tiangolo.com/advanced/events/)
- [pymongo-migrate](https://github.com/stxnext/pymongo-migrate) — reference design (sync-only, not used)
- `docs/configure_db.md` — sections 1 (auth) and 4 (migrations) are the source specs
- `docs/migration-strategy.md` — original implementation plan
