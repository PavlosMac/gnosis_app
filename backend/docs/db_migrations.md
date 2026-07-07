# Database Migrations

Lightweight forward-only migration runner. Each migration runs once and is tracked in a `_migrations` collection. Migrations are the **single owner** of all schema changes — indexes, collection setup, and data transforms.

## How the Runner Works

1. **Discovery** — scans `src/migrations/versions/` for `*.py` files (excluding `__init__.py`), sorted by filename
2. **Tracking** — reads applied versions from the `_migrations` collection
3. **Execution** — for each pending migration, calls `up(db)` then records `version`, `description`, and `applied_at`
4. **Idempotency** — already-applied versions are skipped; `create_index` calls are inherently idempotent

Source: `src/migrations/runner.py`

## Structure

```
src/migrations/
├── __init__.py
├── runner.py          # Discovers and runs pending migrations
└── versions/
    ├── __init__.py
    ├── 001_initial_indexes.py
    └── ...
```

## Migration File Template

```python
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING

from src.database.collections.constants import SOME_COLLECTION

version = "NNN"          # Must match the filename prefix
description = "Short description of what this migration does"


async def up(db: AsyncIOMotorDatabase) -> None:
    # Idempotent operations only
    await db[SOME_COLLECTION].create_index("field_name", unique=True)
```

### Required exports

| Export | Type | Rule |
|--------|------|------|
| `version` | `str` | Zero-padded 3-digit prefix matching the filename (e.g. `"002"`) |
| `description` | `str` | Human-readable summary of the change |
| `up` | `async def up(db: AsyncIOMotorDatabase) -> None` | The migration logic |

## How to Create a New Migration

1. Check the latest version number in `src/migrations/versions/`
2. Create a new file: `src/migrations/versions/NNN_snake_case.py` (increment the prefix)
3. Add `version`, `description`, and `async def up(db)` following the template above
4. Reference collection names via constants from `src/database/collections/constants.py` — add new constants there if needed
5. Keep the migration self-contained: no imports from application code (models, services, schemas)
6. Test locally: `make migrate` or restart the dev server (migrations run at startup)

## How to Run Migrations

Migrations run automatically at app startup — `lifespan()` in `src/main.py` calls
`run_migrations(get_database())` right after `connect_to_mongo()`. To apply a
pending migration without restarting the app, run it manually:

### Local (requires MongoDB running)

```bash
make migrate
```

### Via Docker (dev or prod)

```bash
docker compose exec api .venv/bin/python -m src.migrations.runner
```

In production (where `docker-compose.prod.yml` sets `container_name: gnosis-api`):

```bash
docker exec gnosis-api .venv/bin/python -m src.migrations.runner
```

## Common Patterns

### Index creation

```python
async def up(db: AsyncIOMotorDatabase) -> None:
    await db[USERS_COLLECTION].create_index("email", unique=True)
    await db[USERS_COLLECTION].create_index([("created_at", -1)])
```

`create_index` is idempotent — if the index already exists with the same spec, it's a no-op.

### TTL index

```python
async def up(db: AsyncIOMotorDatabase) -> None:
    await db[TOKENS_COLLECTION].create_index(
        [("expires_at", ASCENDING)], expireAfterSeconds=0
    )
```

### Adding a new collection (with indexes)

```python
async def up(db: AsyncIOMotorDatabase) -> None:
    await db[READINGS_COLLECTION].create_index("user_id")
    await db[READINGS_COLLECTION].create_index([("created_at", -1)])
```

MongoDB creates the collection implicitly when the first index or document is added.

### Data backfill

```python
async def up(db: AsyncIOMotorDatabase) -> None:
    await db[USERS_COLLECTION].update_many(
        {"credits": {"$exists": False}},
        {"$set": {"credits": 0}},
    )
```

Use `$exists` guards or similar filters to make the operation idempotent.

## Rules

- **Forward-only** — no `down()` function; rollbacks are handled by writing a new forward migration
- **Idempotent** — `up()` must be safe to re-run even if the runner skips applied versions
- **Self-contained** — no imports from application code (models, services, schemas); only `src.database.collections.constants`
- **One concern per file** — don't mix unrelated schema changes in a single migration
- **Collection constants** — always reference collections via `src/database/collections/constants.py`, never hardcode strings
- **Version match** — the `version` attribute must match the filename prefix (e.g. `002_foo.py` → `version = "002"`)
