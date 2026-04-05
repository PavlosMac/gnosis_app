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

- [x] Create `mongo/init-user.js` in repo
- [x] Add auth env vars to `docker-compose.prod.yml`
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

See [db_migrations.md](./db_migrations.md) for migration conventions, runner details, and examples.

---

## 5. Checklist

| Concern | Status | Notes |
|---|---|---|
| MongoDB auth | Done | Root + scoped `gnosis_app` user via init script |
| Remote access | Planned | SSH tunnel + management override |
| Backups | Not configured | `mongodump` cron on Pi |
| Migrations | Done | Lightweight runner, tracked in `_migrations` |
| Index management | Done | Managed via migrations |
| TTL indexes | Done | `refresh_tokens.expires_at` |
| Volume persistence | Done | `mongo_data` named volume |
