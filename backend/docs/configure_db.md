# MongoDB — Configuration & Management

Self-hosted MongoDB on the Raspberry Pi, running as a Docker container on `app-network`. See [deployment.md](./deployment.md) for the full Pi architecture.

## 1. Authentication

**Current state:** no auth — any container on `app-network` connects freely. Must be hardened before first prod deploy.

### Strategy: root user + scoped app user

MongoDB's `MONGO_INITDB_*` env vars create a **root** user on first startup (empty volume). An init script then creates a **scoped app user** with only `readWrite` on the `gnosis_esoterica` database. The API connects as the app user — never as root.

### Init script

File: `mongo/init-user.js` (mounted into the container)

```js
// Runs once on first startup (empty volume only).
// Creates a dedicated app user scoped to the gnosis_esoterica database.
db = db.getSiblingDB("gnosis_esoterica");

db.createUser({
  user: "gnosis_app",
  pwd: _getEnv("GNOSIS_APP_PASSWORD"),
  roles: [{ role: "readWrite", db: "gnosis_esoterica" }],
});
```

> `_getEnv()` reads environment variables passed to the `mongod` process.

### Production compose changes

```yaml
services:
  mongodb:
    image: mongo:7
    container_name: gnosis-mongodb
    environment:
      MONGO_INITDB_ROOT_USERNAME: gnosis_admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
      GNOSIS_APP_PASSWORD: ${GNOSIS_APP_PASSWORD}
    volumes:
      - mongo_data:/data/db
      - ./mongo/init-user.js:/docker-entrypoint-initdb.d/init-user.js:ro
    networks:
      - app-network
    restart: unless-stopped
```

### API connection string

In `.env.prod`, the API connects as the scoped user (not root):

```env
MONGODB_URI=mongodb://gnosis_app:<gnosis-app-password>@gnosis-mongodb:27017/gnosis_esoterica?authSource=gnosis_esoterica
```

Note `authSource=gnosis_esoterica` — the app user is created in that database, not in `admin`.

### Dev stays unchanged

No auth in `docker-compose.yml` locally. The default `MONGODB_URI=mongodb://mongodb:27017` continues to work.

### Important caveats

- `MONGO_INITDB_*` and the init script **only run on first startup with an empty volume**. If the volume already has data, you must create the user manually via `mongosh` or delete the volume and start fresh.
- Generate passwords before first deploy:
  ```bash
  openssl rand -hex 16  # MONGO_ROOT_PASSWORD
  openssl rand -hex 16  # GNOSIS_APP_PASSWORD
  ```
- Both passwords live in `.env.prod` on the Pi only — never committed to the repo.

### Remote access with auth

When using the SSH tunnel (section 2), connect as root for admin tasks:
```bash
mongosh "mongodb://gnosis_admin:<root-password>@localhost:27017/gnosis_esoterica?authSource=admin"
```

Or as the app user for the same view the API has:
```bash
mongosh "mongodb://gnosis_app:<app-password>@localhost:27017/gnosis_esoterica?authSource=gnosis_esoterica"
```

### Backup commands with auth

```bash
docker exec gnosis-mongodb mongodump --archive --gzip \
  --uri="mongodb://gnosis_admin:<root-password>@localhost:27017/gnosis_esoterica?authSource=admin"
```

### TODO

- [ ] Create `mongo/init-user.js` in repo
- [ ] Add auth env vars to `docker-compose.prod.yml`
- [ ] Generate and store passwords in `.env.prod` on Pi before first deploy

---

## 2. Remote Access (SSH Tunnel)

MongoDB is not exposed to the host or LAN. To manage it from your Mac, use an SSH tunnel.

### Step 1 — Temporary port exposure on the Pi

Create a compose override on the Pi:

**`~/gnosis-esoterica/docker-compose.mgmt.yml`**
```yaml
services:
  mongodb:
    ports:
      - "127.0.0.1:27017:27017"  # Pi localhost only
```

```bash
# Start with management access
cd ~/gnosis-esoterica
docker compose -f docker-compose.prod.yml -f docker-compose.mgmt.yml up -d

# When done, restart without the override
docker compose -f docker-compose.prod.yml up -d
```

### Step 2 — SSH tunnel from Mac

```bash
ssh -N -L 27017:localhost:27017 pi@<pi-ip>
```

Now on your Mac:
```bash
# mongosh
mongosh "mongodb://localhost:27017/gnosis_esoterica"

# Or open MongoDB Compass → connect to localhost:27017
```

---

## 3. Backups

### Automated backup with cron (on the Pi)

```bash
# Create backup directory
mkdir -p ~/backups/mongodb
```

Add a cron job:
```bash
crontab -e
```

```cron
# Daily MongoDB backup at 3am, keep last 7 days
0 3 * * * docker exec gnosis-mongodb mongodump --archive --gzip --uri="mongodb://gnosis_admin:$MONGO_ROOT_PASSWORD@localhost:27017/gnosis_esoterica?authSource=admin" > ~/backups/mongodb/gnosis_$(date +\%Y\%m\%d).gz 2>/dev/null && find ~/backups/mongodb -name "*.gz" -mtime +7 -delete
```

> Tip: store `MONGO_ROOT_PASSWORD` in a file the cron job sources, or hardcode it in the cron entry (only root can read crontab).

### Manual backup

```bash
docker exec gnosis-mongodb mongodump --archive --gzip \
  --uri="mongodb://gnosis_admin:<root-password>@localhost:27017/gnosis_esoterica?authSource=admin" \
  > ~/backups/mongodb/gnosis_manual.gz
```

### Restore

```bash
docker exec -i gnosis-mongodb mongorestore --archive --gzip \
  --uri="mongodb://gnosis_admin:<root-password>@localhost:27017/gnosis_esoterica?authSource=admin" \
  < ~/backups/mongodb/gnosis_manual.gz
```

---

## 4. Migrations

Lightweight idempotent migration runner. Each migration runs once and is tracked in a `_migrations` collection.

### Structure

```
src/migrations/
├── __init__.py
├── runner.py          # Discovers and runs pending migrations
└── versions/
    ├── __init__.py
    ├── 001_initial_indexes.py
    ├── 002_add_readings_collection.py
    └── ...
```

### Migration file format

Each file exports `version`, `description`, and an `async up(db)` function:

```python
# src/migrations/versions/001_initial_indexes.py
from motor.motor_asyncio import AsyncIOMotorDatabase

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

### Runner logic

```python
# src/migrations/runner.py (pseudocode)
async def run_migrations(db):
    migrations_col = db["_migrations"]
    applied = {doc["version"] async for doc in migrations_col.find()}

    for migration in discover_migrations():  # sorted by version
        if migration.version not in applied:
            await migration.up(db)
            await migrations_col.insert_one({
                "version": migration.version,
                "description": migration.description,
                "applied_at": datetime.utcnow(),
            })
```

### How to run

**Development** — called at app startup (in `lifespan`), after `connect_to_mongo()`:
```python
await run_migrations(get_database())
await _ensure_indexes()  # can eventually move all index creation into migrations
```

**Production** — via `docker exec` before or after deploying a new image:
```bash
docker exec gnosis-api .venv/bin/python -m src.migrations.runner
```

Or integrated into the lifespan (same as dev) — safe because each migration is idempotent and only runs once.

### Relationship to `ensure_indexes()`

The existing `ensure_indexes()` pattern (called at startup in `main.py`) already handles index creation idempotently — `create_index` is a no-op if the index exists. Two options going forward:

1. **Keep both** — `ensure_indexes()` for indexes, migrations for data changes. Simple, no refactor needed.
2. **Consolidate** — move index creation into migration files. Cleaner long-term, but not urgent.

Recommend option 1 for now.

### TODO

- [ ] Create `src/migrations/` package with runner
- [ ] Write first migration (can mirror current `ensure_indexes` or start with next schema change)
- [ ] Add `run_migrations()` call to `lifespan` in `main.py`
- [ ] Add `make migrate` command to Makefile

---

## 5. Checklist

| Concern | Status | Notes |
|---|---|---|
| MongoDB auth | Planned | Root + scoped `gnosis_app` user via init script |
| Remote access | Planned | SSH tunnel + management override |
| Backups | Not configured | `mongodump` cron on Pi |
| Migrations | Not built | Lightweight runner, tracked in `_migrations` |
| Index management | Done | `ensure_indexes()` at startup |
| TTL indexes | Done | `refresh_tokens.expires_at` |
| Volume persistence | Done | `mongo_data` named volume |
