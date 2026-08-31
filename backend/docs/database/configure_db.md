# MongoDB — Configuration & Management

Self-hosted MongoDB on the Raspberry Pi, running as a Docker container on `app-network`. See [deployment.md](../deployment/deployment.md) for the full Pi architecture.

## 1. Authentication

**Current state:** auth enforced (`mongod --auth`). Root user `gnosis_admin` + scoped app user `gnosis_app`. Verified on the Pi 2026-08-29.

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
  pwd: process.env.GNOSIS_APP_PASSWORD,
  roles: [{ role: "readWrite", db: "gnosis_esoterica" }],
});
```

> `process.env` is available to init scripts run by the `mongo` image entrypoint.

### Production compose changes

```yaml
services:
  mongodb:
    image: mongo:7
    container_name: gnosis-mongodb
    command: ["mongod", "--auth", "--quiet", "--wiredTigerCacheSizeGB", "0.25"]
    # no ports: — only reachable on app-network
    environment:
      MONGO_INITDB_ROOT_USERNAME: gnosis_admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
      GNOSIS_APP_PASSWORD: ${GNOSIS_APP_PASSWORD}
    volumes:
      - mongo_data:/data/db
      - ./mongo/init-user.js:/docker-entrypoint-initdb.d/init-user.js:ro
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "bash", "-c", "</dev/tcp/127.0.0.1/27017"]
      interval: 30s
      timeout: 5s
      retries: 3
    restart: unless-stopped
```

Full file: `docker-compose.prod.yml`.

### API connection string

In `.env.gnosis.prod`, the API connects as the scoped user (not root):

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
- Both passwords live in `.env.gnosis.prod` on the Pi only — never committed to the repo.

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

- [x] Create `mongo/init-user.js` in repo
- [x] Add auth env vars to `docker-compose.prod.yml`
- [x] Generate and store passwords in `.env.gnosis.prod` on Pi (verified 2026-08-29: `gnosis_admin` + `gnosis_app` exist, `--auth` enforced)
- See [production_mongo_commands.md](./production_mongo_commands.md) for the day-to-day access workflow

---

## 2. Remote Access (SSH Tunnel)

MongoDB is not exposed to the host or LAN.

**Preferred:** `scripts/pi-mongo.sh` — runs `mongosh` inside the container over SSH, no port exposure. See [production_mongo_commands.md](./production_mongo_commands.md).

**GUI (Compass) only:** temporarily publish the port on the Pi and tunnel, as below.

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

Implemented in `backup/` (`Dockerfile` + `backup-to-atlas.sh`), designed in
`docs/deployment/mongodb-backup-design.md`.

The script runs in its own container on `app-network` and, in order:

1. `mongodump` of `gnosis_esoterica` → `$BACKUP_DIR/gnosis_esoterica-<stamp>.archive.gz` (default `/home/pi/mongo-backups`)
2. `rclone copy` of the archive to Backblaze B2 (`$B2_REMOTE`)
3. `mongorestore --drop` into a MongoDB Atlas mirror (`$ATLAS_URI`)
4. Local retention: keep the 7 newest archives

Any failed step posts one message to `$DISCORD_WEBHOOK_URL`.

Required env: `MONGO_URI` (use `gnosis_admin`, `authSource=admin`, host `gnosis-mongodb:27017`),
`ATLAS_URI`, `B2_REMOTE`, `DISCORD_WEBHOOK_URL`, optional `BACKUP_DIR`.

### Manual one-off backup (no offsite)

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

See [db_migrations.md](./db_migrations.md) for migration conventions, runner details, and examples.

---

## 5. Checklist

| Concern | Status | Notes |
|---|---|---|
| MongoDB auth | Done | Root + scoped `gnosis_app` user via init script |
| Remote access | Done | `scripts/pi-mongo.sh` over SSH; Compass via tunnel when needed |
| Backups | Done | `backup/backup-to-atlas.sh`: dump → B2 → Atlas mirror, Discord on failure |
| Migrations | Done | Lightweight runner, tracked in `_migrations` |
| Index management | Done | Managed via migrations |
| TTL indexes | Done | `refresh_tokens.expires_at` |
| Volume persistence | Done | `mongo_data` named volume |
