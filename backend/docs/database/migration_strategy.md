# Plan: MongoDB Auth Init Script + Migration Runner

> **Archived — fully implemented.** Kept for design history. Current docs:
> [configure_db.md](./configure_db.md) (auth), [db_migrations.md](./db_migrations.md) (runner).

## Context

The project runs MongoDB without authentication in dev. Before first prod deploy, we need:
1. A **MongoDB init script** that creates a scoped app user (`gnosis_app`) — the "user to authenticate against"
2. A **production docker-compose** that enables MongoDB auth and mounts the init script
3. A **lightweight migration runner** tracked in a `_migrations` collection, called at app startup

Design follows `docs/database/configure_db.md` sections 1 and 4.

---

## Part 1: MongoDB Auth Setup

### 1.1 Create `mongo/init-user.js`

Runs once on first startup with an empty volume. Creates a dedicated app user scoped to `gnosis_esoterica`.

```js
db = db.getSiblingDB("gnosis_esoterica");
db.createUser({
  user: "gnosis_app",
  pwd: _getEnv("GNOSIS_APP_PASSWORD"),
  roles: [{ role: "readWrite", db: "gnosis_esoterica" }],
});
```

### 1.2 Create `docker-compose.prod.yml`

Production override with auth enabled. Kept separate from `docker-compose.yml` (dev stays unchanged — no auth).

Key differences from dev:
- `MONGO_INITDB_ROOT_USERNAME/PASSWORD` env vars on MongoDB service
- `GNOSIS_APP_PASSWORD` env var passed through for init script
- Init script mounted read-only into `/docker-entrypoint-initdb.d/`
- Container named `gnosis-mongodb` (matches prod URI in `.env.prod.example`)
- API uses `.env.prod` instead of `.env`
- No bind-mount of `src/` (no hot-reload in prod)
- No `--reload` flag on uvicorn

### 1.3 Update `Makefile`

Add prod Docker commands:
- `make docker-prod-up` — `docker compose -f docker-compose.prod.yml up -d`
- `make docker-prod-down` — `docker compose -f docker-compose.prod.yml down`

---

## Part 2: Migration Runner

### 2.1 Create `src/migrations/__init__.py` (empty)

### 2.2 Create `src/migrations/versions/__init__.py` (empty)

### 2.3 Create `src/migrations/runner.py`

Core logic:
- `discover_migrations()` — imports all `*.py` files from `versions/`, sorted by filename prefix (e.g. `001_`, `002_`), returns list of module objects each having `version`, `description`, `up(db)`
- `run_migrations(db)` — reads `_migrations` collection for already-applied versions, runs pending ones in order, inserts a record after each successful run
- `__main__` block — allows `python -m src.migrations.runner` for CLI usage (connects to mongo, runs migrations, disconnects)

Uses `structlog` for logging each migration applied/skipped.

Key file: `src/database/mongodb.py` — reuses `connect_to_mongo()`, `get_database()`, `close_mongo_connection()`

### 2.4 Create `src/migrations/versions/001_initial_indexes.py`

First migration mirrors current `ensure_indexes()` calls as a reference implementation. Since `create_index` is idempotent, this is safe to run alongside the existing `ensure_indexes()`.

```python
version = "001"
description = "Create initial indexes for users and refresh tokens"

async def up(db: AsyncIOMotorDatabase) -> None:
    await db.users.create_index("email", unique=True)
    await db.users.create_index("stripe_customer_id", unique=True, sparse=True)
    await db.users.create_index([("created_at", -1)])
    await db.refresh_tokens.create_index("jti", unique=True)
    await db.refresh_tokens.create_index("family_id")
    await db.refresh_tokens.create_index([("expires_at", 1)], expireAfterSeconds=0)
```

### 2.5 Modify `src/main.py` — integrate into lifespan

Add `await run_migrations(get_database())` after `connect_to_mongo()` and before `_ensure_indexes()`:

```python
await connect_to_mongo()
await run_migrations(get_database())  # NEW
# ... mediator wiring ...
await _ensure_indexes()
```

Import: `from src.migrations.runner import run_migrations`

### 2.6 Update `Makefile`

Add: `make migrate` — `uv run python -m src.migrations.runner`

---

## Files Summary

| Action | File |
|--------|------|
| Create | `mongo/init-user.js` |
| Create | `docker-compose.prod.yml` |
| Create | `src/migrations/__init__.py` |
| Create | `src/migrations/versions/__init__.py` |
| Create | `src/migrations/runner.py` |
| Create | `src/migrations/versions/001_initial_indexes.py` |
| Create | `tests/migrations/test_runner.py` |
| Create | `tests/migrations/__init__.py` |
| Modify | `src/main.py` (add `run_migrations` call + import) |
| Modify | `Makefile` (add `migrate`, `docker-prod-up`, `docker-prod-down`) |
| Modify | `docs/database/configure_db.md` (tick off completed TODOs) |

---

## Testing

### Migration runner tests (`tests/migrations/test_runner.py`)

Using existing `mongomock-motor` setup from `conftest.py`:

1. `test_run_migrations_applies_pending` — verify a migration's `up()` runs and a record is inserted into `_migrations`
2. `test_run_migrations_skips_already_applied` — insert a record into `_migrations` first, verify `up()` is not called again
3. `test_run_migrations_applies_in_order` — with multiple migrations, verify they run in version order
4. `test_discover_migrations_sorted` — verify discovered migrations are sorted by filename

### Verification

1. `make test` — all existing + new tests pass
2. `make lint` — no ruff violations
3. `make docker-up` — dev still works without auth
4. Manual: `docker compose -f docker-compose.prod.yml up` with `.env.prod` — MongoDB starts with auth, init script creates user
