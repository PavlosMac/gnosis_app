# MongoDB Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a one-shot Docker container that dumps `gnosis_esoterica` from the Pi's MongoDB, ships the archive to Backblaze B2, and mirrors it into an Atlas M0 cluster — with a Discord alert on failure — plus the Pi cron wiring to run it nightly.

**Architecture:** A single bash script (`backup/backup-to-atlas.sh`) runs `mongodump` → `rclone copy` → `mongorestore --drop` → local retention cleanup, wrapped in an `ERR` trap that posts to a Discord webhook naming the failed step. It ships in a `debian:bookworm-slim` image with `mongodb-database-tools` + `rclone` + `curl`. Production runs it via host cron on the Pi, joined to the existing `app-network` Docker network. Tasks 1–3 build and test the script itself against the local dev Mongo (works from this machine, no Pi needed). Tasks 4–5 are Pi-only setup/config that can only be documented here, not executed.

**Tech Stack:** bash (`set -Eeuo pipefail` — the `-E` is required so the `ERR` trap fires inside functions), Docker, `mongodb-database-tools` (mongodump/mongorestore), `rclone`, `curl`.

## Global Constraints

- Database name is `gnosis_esoterica` (not `gnosis` — the earlier draft had this wrong).
- Production Mongo connection: `gnosis-mongodb:27017` on the `app-network` Docker network, authenticating as `gnosis_admin` with `authSource=admin`. Never `--network host` / `localhost` in production.
- Atlas restore always uses `--drop` (true mirror, reflects deletions).
- Local archive retention: keep the last 7 archives, delete older ones.
- Discord webhook fires only on failure, naming which step failed. Success is silent — no message.
- Secrets (`MONGO_URI`, `ATLAS_URI`, `B2_REMOTE` credentials, `DISCORD_WEBHOOK_URL`) live only in a `600`-perms env file on the Pi — never hardcoded, never committed.
- B2 bucket and Atlas M0 cluster already exist — no account/cluster provisioning in scope.
- Pi is a Pi 5 (Cortex-A76) — no legacy ARM tooling/pinning needed.
- The container is one-shot (runs the script top to bottom and exits) — not a daemon.

---

## Group A — backup/sync mechanic (buildable and testable on this machine)

### Task 1: Backup script + Docker image

**Files:**
- Create: `backup/backup-to-atlas.sh`
- Create: `backup/Dockerfile`

**Interfaces:**
- Produces: image tagged `gnosis-backup`, entrypoint `/usr/local/bin/backup-to-atlas.sh`.
- Produces (script functions, used conceptually by later tasks' test steps): `dump_database`, `upload_offsite`, `mirror_to_atlas`, `enforce_retention`, `notify_failure "$STEP"`, `log "$msg"`.
- Required env vars (script fails fast via `: "${VAR:?...}"` if unset): `MONGO_URI`, `ATLAS_URI`, `B2_REMOTE`, `DISCORD_WEBHOOK_URL`.
- Optional env var: `BACKUP_DIR` (default `/home/pi/mongo-backups`).

- [ ] **Step 1: Create the `backup/` directory and write the script**

```bash
mkdir -p /Users/pavlos/projects/private/gnosis-esoterica-api/backup
```

Write `backup/backup-to-atlas.sh`:

```bash
#!/usr/bin/env bash
# Dump gnosis_esoterica -> compressed archive -> B2 offsite copy -> Atlas mirror.
# On any failure, posts one message to DISCORD_WEBHOOK_URL naming the failed step.
set -Eeuo pipefail

STAMP=$(date +%Y%m%d-%H%M%S)
OUT="${BACKUP_DIR:-/home/pi/mongo-backups}"
FILE="$OUT/gnosis_esoterica-${STAMP}.archive.gz"
mkdir -p "$OUT"

: "${MONGO_URI:?set MONGO_URI in the environment}"
: "${ATLAS_URI:?set ATLAS_URI in the environment}"
: "${B2_REMOTE:?set B2_REMOTE, e.g. b2:gnosis-backups}"
: "${DISCORD_WEBHOOK_URL:?set DISCORD_WEBHOOK_URL in the environment}"

STEP="startup"

log() {
  echo "$(date -Is) $*"
}

notify_failure() {
  local failed_step="$1"
  curl -fsS -X POST -H "Content-Type: application/json" \
    -d "{\"content\": \"gnosis backup FAILED at step: ${failed_step} (${STAMP})\"}" \
    "$DISCORD_WEBHOOK_URL" >/dev/null 2>&1 || true
}

trap 'notify_failure "$STEP"' ERR

dump_database() {
  STEP="dump"
  log "dumping gnosis_esoterica -> $FILE"
  mongodump --uri="$MONGO_URI" --archive="$FILE" --gzip
}

upload_offsite() {
  STEP="upload"
  log "uploading to $B2_REMOTE"
  rclone copy "$FILE" "$B2_REMOTE/"
}

mirror_to_atlas() {
  STEP="mirror"
  log "mirroring into Atlas"
  mongorestore --uri="$ATLAS_URI" --archive="$FILE" --gzip --drop
}

enforce_retention() {
  STEP="retention"
  local retained_count=7
  # shellcheck disable=SC2012
  ls -1t "$OUT"/gnosis_esoterica-*.archive.gz | tail -n "+$((retained_count + 1))" | xargs -r rm --
}

dump_database
upload_offsite
mirror_to_atlas
enforce_retention

STEP="done"
log "backup ok: $FILE"
```

- [ ] **Step 2: Make the script executable**

```bash
chmod +x /Users/pavlos/projects/private/gnosis-esoterica-api/backup/backup-to-atlas.sh
```

- [ ] **Step 3: Write the Dockerfile**

Write `backup/Dockerfile`:

```dockerfile
# Pi 5 / Cortex-A76 (ARMv8.2-A). MongoDB does not publish a Debian arm64 build of
# mongodb-database-tools, so we take the Ubuntu 22.04 arm64 tarball instead — its
# glibc-linked binaries run fine on Debian 12 given the same runtime libs.
FROM debian:bookworm-slim

ARG DB_TOOLS_VERSION=100.17.0

RUN apt-get update && apt-get install -y --no-install-recommends \
      wget ca-certificates curl rclone \
      libgssapi-krb5-2 libssl3 libsasl2-2 && \
    wget -q "https://fastdl.mongodb.org/tools/db/mongodb-database-tools-ubuntu2204-arm64-${DB_TOOLS_VERSION}.tgz" \
      -O /tmp/tools.tgz && \
    tar -xzf /tmp/tools.tgz -C /tmp && \
    mv /tmp/mongodb-database-tools-ubuntu2204-arm64-${DB_TOOLS_VERSION}/bin/* /usr/local/bin/ && \
    rm -rf /tmp/tools.tgz /tmp/mongodb-database-tools-ubuntu2204-arm64-${DB_TOOLS_VERSION} && \
    rm -rf /var/lib/apt/lists/*

COPY backup-to-atlas.sh /usr/local/bin/backup-to-atlas.sh
RUN chmod +x /usr/local/bin/backup-to-atlas.sh
ENTRYPOINT ["/usr/local/bin/backup-to-atlas.sh"]
```

- [ ] **Step 4: Build the image**

Run: `docker build -t gnosis-backup /Users/pavlos/projects/private/gnosis-esoterica-api/backup`
Expected: build completes with `Successfully tagged gnosis-backup:latest` (or Buildx's equivalent final `naming to docker.io/library/gnosis-backup` line) and no errors.

- [ ] **Step 5: Verify mongodump is present and runs**

Run: `docker run --rm --entrypoint mongodump gnosis-backup --version`
Expected: output starting with `mongodump version: 100.` (or similar `100.x.y`) — no "illegal instruction" crash.

- [ ] **Step 6: Verify mongorestore is present and runs**

Run: `docker run --rm --entrypoint mongorestore gnosis-backup --version`
Expected: output starting with `mongorestore version: 100.`.

- [ ] **Step 7: Verify rclone is present and runs**

Run: `docker run --rm --entrypoint rclone gnosis-backup version`
Expected: first line starts with `rclone v`.

- [ ] **Step 8: Verify curl is present**

Run: `docker run --rm --entrypoint curl gnosis-backup --version`
Expected: first line starts with `curl `.

- [ ] **Step 9: Commit**

```bash
cd /Users/pavlos/projects/private/gnosis-esoterica-api
git add backup/backup-to-atlas.sh backup/Dockerfile
git commit -m "feat: add MongoDB backup script and Docker image"
```

---

### Task 2: End-to-end test against local dev Mongo

Uses the repo's existing dev `docker-compose.yml` Mongo container as the "production" source, a local host folder standing in for the B2 bucket (rclone's local-filesystem backend needs no cloud credentials), and a second local database standing in for the Atlas mirror target. This proves the whole dump → copy → mirror → retention chain actually works, without touching real B2/Atlas.

**Files:** none created — this is a verification task against Task 1's artifacts.

**Interfaces:**
- Consumes: `gnosis-backup` image from Task 1.
- Consumes: dev Mongo from `docker-compose.yml` (service `mongodb`, database `gnosis_esoterica`, reachable at `mongodb:27017` on the `gnosis-esoterica-api_default` Docker network — confirmed present via `docker network ls`).

- [ ] **Step 1: Start the dev Mongo container**

```bash
cd /Users/pavlos/projects/private/gnosis-esoterica-api
docker compose up -d mongodb
```

Expected: `docker compose ps mongodb` shows state `running (healthy)` within ~20s.

- [ ] **Step 2: Seed a marker document**

```bash
docker run --rm --network gnosis-esoterica-api_default mongo:7 \
  mongosh "mongodb://mongodb:27017/gnosis_esoterica" --quiet \
  --eval 'db.backup_smoke_test.insertOne({marker: "backup-plan-task-2"})'
```

Expected: output includes `acknowledged: true`.

- [ ] **Step 3: Prepare local scratch dirs, and a second standalone Mongo container as the "Atlas" target**

`mongorestore` restores into the same database name recorded in the archive (`gnosis_esoterica`), ignoring any different database name in `--uri`'s path — so a same-server, differently-named "Atlas" database does not work as a stand-in. Use a genuinely separate Mongo container instead (this matches production anyway, where Atlas is a different server).

```bash
mkdir -p /tmp/gnosis-backup-test/archives /tmp/gnosis-backup-test/b2-local
docker run -d --rm --name gnosis-backup-test-atlas --network gnosis-esoterica-api_default mongo:7 >/dev/null
sleep 3
docker exec gnosis-backup-test-atlas mongosh --quiet --eval 'db.runCommand({ping:1})'
```

Expected: `{ ok: 1 }`.

- [ ] **Step 4: Run the backup container against the dev Mongo, a local-dir "B2", and the standalone "Atlas" container**

```bash
docker run --rm \
  --network gnosis-esoterica-api_default \
  -e MONGO_URI="mongodb://mongodb:27017/gnosis_esoterica" \
  -e ATLAS_URI="mongodb://gnosis-backup-test-atlas:27017/gnosis_esoterica" \
  -e B2_REMOTE="/b2-local" \
  -e DISCORD_WEBHOOK_URL="http://example.invalid/webhook" \
  -e BACKUP_DIR="/backups" \
  -v /tmp/gnosis-backup-test/archives:/backups \
  -v /tmp/gnosis-backup-test/b2-local:/b2-local \
  gnosis-backup
```

Expected: exits 0, last log line matches `backup ok: /backups/gnosis_esoterica-<timestamp>.archive.gz`, and the mongorestore output reports `24 document(s) restored successfully. 0 document(s) failed to restore.` (5 + 8 + 4 + 6 + 1 across the dev seed data's collections plus the marker doc).

- [ ] **Step 5: Verify the local archive was written**

Run: `ls /tmp/gnosis-backup-test/archives/`
Expected: one file matching `gnosis_esoterica-*.archive.gz`.

- [ ] **Step 6: Verify the archive was copied to the "B2" folder**

Run: `ls /tmp/gnosis-backup-test/b2-local/`
Expected: the same filename as Step 5.

- [ ] **Step 7: Verify the "Atlas" mirror received the data**

```bash
docker exec gnosis-backup-test-atlas mongosh "mongodb://localhost:27017/gnosis_esoterica" --quiet \
  --eval 'db.backup_smoke_test.countDocuments({})'
```

Expected: prints `1`.

- [ ] **Step 8: Set up a retention fixture — 8 fake old archives**

macOS `seq -w` does not zero-pad when the range's endpoints are both single-digit — use `printf "%02d"` instead.

```bash
for i in 1 2 3 4 5 6 7 8; do
  padded=$(printf "%02d" "$i")
  touch -t "202501010000.${padded}" "/tmp/gnosis-backup-test/archives/gnosis_esoterica-2025010${padded}-000000.archive.gz"
done
ls /tmp/gnosis-backup-test/archives/ | wc -l
```

Expected: `9` (8 fake fixtures + the 1 real archive from Step 4).

- [ ] **Step 9: Run the backup container again to trigger retention cleanup**

```bash
docker run --rm \
  --network gnosis-esoterica-api_default \
  -e MONGO_URI="mongodb://mongodb:27017/gnosis_esoterica" \
  -e ATLAS_URI="mongodb://gnosis-backup-test-atlas:27017/gnosis_esoterica" \
  -e B2_REMOTE="/b2-local" \
  -e DISCORD_WEBHOOK_URL="http://example.invalid/webhook" \
  -e BACKUP_DIR="/backups" \
  -v /tmp/gnosis-backup-test/archives:/backups \
  -v /tmp/gnosis-backup-test/b2-local:/b2-local \
  gnosis-backup
```

Expected: exits 0 (this run creates a 10th archive, then retention trims to 7).

- [ ] **Step 10: Verify only the 7 newest archives remain**

Run: `ls -1t /tmp/gnosis-backup-test/archives/ | wc -l`
Expected: `7`.

Run: `ls -1t /tmp/gnosis-backup-test/archives/ | tail -1`
Expected: one of the older fake fixtures from Step 8, **not** the real archive from Step 4 (confirms it sorts/deletes by mtime, oldest first).

- [ ] **Step 11: Clean up test artifacts**

```bash
rm -rf /tmp/gnosis-backup-test
docker stop gnosis-backup-test-atlas >/dev/null
docker run --rm --network gnosis-esoterica-api_default mongo:7 \
  mongosh "mongodb://mongodb:27017/gnosis_esoterica" --quiet \
  --eval 'db.backup_smoke_test.drop()'
```

No commit for this task — it's a verification pass over Task 1's artifacts with no new files.

---

### Task 3: Failure-notification test

Confirms the `ERR` trap fires exactly once and posts the right step name, without needing a real Discord webhook — captured with a local raw listener instead.

**Files:** none created — verification task.

**Interfaces:**
- Consumes: `gnosis-backup` image from Task 1.

- [ ] **Step 1: Prepare a scratch dir and start a capture listener in the background**

macOS has no `timeout` builtin, so track the listener's PID and stop it manually in Step 5 instead.

```bash
mkdir -p /tmp/gnosis-backup-test
rm -f /tmp/gnosis-backup-test/webhook_capture.txt
nohup nc -l 8090 > /tmp/gnosis-backup-test/webhook_capture.txt 2>/tmp/gnosis-backup-test/nc_stderr.txt &
echo $! > /tmp/gnosis-backup-test/nc.pid
sleep 1
ps -p "$(cat /tmp/gnosis-backup-test/nc.pid)"
```

Expected: shows the running `nc -l 8090` process.

- [ ] **Step 2: Run the backup container with an unreachable Mongo host so `dump_database` fails**

```bash
docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  -e MONGO_URI="mongodb://backup-test-invalid-host:27017/gnosis_esoterica" \
  -e ATLAS_URI="mongodb://backup-test-invalid-host:27017/irrelevant" \
  -e B2_REMOTE="/b2-local" \
  -e DISCORD_WEBHOOK_URL="http://host.docker.internal:8090/webhook" \
  -e BACKUP_DIR="/backups" \
  -v /tmp/gnosis-backup-test/archives:/backups \
  gnosis-backup; echo "exit code: $?"
```

Expected: `exit code: 1` (or another non-zero code) — the dump step must fail before anything else runs.

- [ ] **Step 3: Wait for the capture listener to flush, then inspect it**

```bash
sleep 2
cat /tmp/gnosis-backup-test/webhook_capture.txt
```

Expected: the captured HTTP request's body contains `"content": "gnosis backup FAILED at step: dump`.

- [ ] **Step 4: Confirm exactly one POST was captured**

Run: `grep -c '^POST ' /tmp/gnosis-backup-test/webhook_capture.txt`
Expected: `1`.

- [ ] **Step 5: Clean up**

```bash
kill "$(cat /tmp/gnosis-backup-test/nc.pid)" 2>/dev/null || true
rm -rf /tmp/gnosis-backup-test
```

No commit for this task — verification only, script behavior already matches spec from Task 1.

---

## Group B — scheduler mechanic (Pi-only: env template, docs, cron — not executable from this machine)

### Task 4: Env template + README

**Files:**
- Create: `backup/.mongo-backup.env.example`
- Create: `backup/README.md`

**Interfaces:**
- Consumes: required env vars from Task 1 (`MONGO_URI`, `ATLAS_URI`, `B2_REMOTE`, `DISCORD_WEBHOOK_URL`, optional `BACKUP_DIR`).

- [ ] **Step 1: Write the env template**

Write `backup/.mongo-backup.env.example`:

```bash
# Copy to .mongo-backup.env on the Pi, fill in real values, chmod 600. DO NOT COMMIT the real file.
export MONGO_URI="mongodb://gnosis_admin:<root-password>@gnosis-mongodb:27017/gnosis_esoterica?authSource=admin"
export ATLAS_URI="mongodb+srv://user:<password>@cluster.mongodb.net/"
export B2_REMOTE="b2:gnosis-backups"
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/<id>/<token>"
export BACKUP_DIR="/home/pi/mongo-backups"
```

- [ ] **Step 2: Verify the template covers every required var from the script**

```bash
cd /Users/pavlos/projects/private/gnosis-esoterica-api
grep -oE '"\$\{[A-Z_]+:\?' backup/backup-to-atlas.sh | grep -oE '[A-Z_]+'
```

Expected: `MONGO_URI`, `ATLAS_URI`, `B2_REMOTE`, `DISCORD_WEBHOOK_URL` (in some order).

```bash
for v in MONGO_URI ATLAS_URI B2_REMOTE DISCORD_WEBHOOK_URL; do
  grep -q "^export $v=" backup/.mongo-backup.env.example && echo "$v OK" || echo "$v MISSING"
done
```

Expected: `OK` for all four.

- [ ] **Step 3: Write the README**

Write `backup/README.md`:

```markdown
# gnosis MongoDB backup

Nightly job: dump `gnosis_esoterica` from the Pi's MongoDB, ship the archive to Backblaze B2, and mirror it into an Atlas M0 cluster as a warm standby. Runs as a one-shot Docker container triggered by host cron — not a daemon.

## Build

On the Pi (or cross-build and push to a registry if you prefer):

\`\`\`bash
docker build -t gnosis-backup backup/
\`\`\`

## Configure secrets

\`\`\`bash
cp backup/.mongo-backup.env.example /home/pi/.mongo-backup.env
chmod 600 /home/pi/.mongo-backup.env
\`\`\`

Fill in `/home/pi/.mongo-backup.env`:
- `MONGO_URI` — use the existing `gnosis_admin` root credentials (see `../docs/configure_db.md`), pointed at `gnosis-mongodb:27017`, `authSource=admin`.
- `ATLAS_URI` — connection string for the existing Atlas M0 cluster. Atlas Network Access is set to allow `0.0.0.0/0`; security relies on this being a long random Atlas user password, not on IP filtering.
- `B2_REMOTE` — the existing Backblaze B2 bucket's rclone remote, e.g. `b2:gnosis-backups`.
- `DISCORD_WEBHOOK_URL` — a Discord channel webhook URL. The script only posts to it on failure; a successful run is silent.

## rclone config (one-time, on the Pi)

\`\`\`bash
rclone config
# n) new remote -> name "b2" -> storage "Backblaze B2" -> paste application key ID + key
\`\`\`

rclone's config lives on the host at `~/.config/rclone`. Mount it read-only into the container rather than baking credentials into the image (see run command below).

## Run manually

\`\`\`bash
mkdir -p /home/pi/mongo-backups
docker run --rm \
  --network app-network \
  --env-file /home/pi/.mongo-backup.env \
  -v /home/pi/mongo-backups:/home/pi/mongo-backups \
  -v /home/pi/.config/rclone:/root/.config/rclone:ro \
  gnosis-backup
\`\`\`

## Install the cron job

\`\`\`bash
crontab -e
\`\`\`

Add:

\`\`\`cron
0 3 * * * docker run --rm --network app-network --env-file /home/pi/.mongo-backup.env -v /home/pi/mongo-backups:/home/pi/mongo-backups -v /home/pi/.config/rclone:/root/.config/rclone:ro gnosis-backup >> /home/pi/mongo-backups/backup.log 2>&1
\`\`\`

## Restore test (run this after first setting up, and periodically after)

Restore into a throwaway namespace and compare doc counts against the source — never restore over the live `gnosis_esoterica` database on a test run.

\`\`\`bash
docker exec gnosis-mongodb mongorestore --archive=/home/pi/mongo-backups/<file> --gzip \
  --nsFrom='gnosis_esoterica.*' --nsTo='gnosis_esoterica_test.*' \
  --uri="mongodb://gnosis_admin:<root-password>@localhost:27017/?authSource=admin"
\`\`\`

Then compare `gnosis_esoterica_test` collection doc counts against `gnosis_esoterica` via `mongosh`, and drop the test database when done.

## Notes

- Built and tested against a Pi 5 (Cortex-A76). `mongodump`/`mongorestore` come from MongoDB's Ubuntu 22.04 arm64 tarball (no Debian arm64 build exists) — the binaries run fine on Debian 12 with `libgssapi-krb5-2`/`libssl3`/`libsasl2-2` installed. If this ever moves to a Pi 4 (Cortex-A72), MongoDB 5.0+ tools crash with "illegal instruction" — you'd need an older tools version pinned via `DB_TOOLS_VERSION`.
- The Atlas restore always uses `--drop`, so the mirror reflects deletions on the Pi, not just inserts.
- Local retention: last 7 archives are kept on the Pi; older ones are deleted automatically.
```

- [ ] **Step 4: Commit**

```bash
cd /Users/pavlos/projects/private/gnosis-esoterica-api
git add backup/.mongo-backup.env.example backup/README.md
git commit -m "docs: add backup env template and README"
```

---

### Task 5: Update `docs/configure_db.md`'s stale Backups section

The existing "Backups" section (lines 142–178) describes a different, simpler, never-implemented approach (plain host-cron `mongodump` to a local folder, no offsite copy, no mirror) and the checklist row says "Not configured." Both are now stale and contradict `backup/README.md`.

**Files:**
- Modify: `docs/configure_db.md:142-178` (section "## 3. Backups")
- Modify: `docs/configure_db.md:193` (checklist row)

- [ ] **Step 1: Replace the Backups section body**

In `docs/configure_db.md`, replace lines 142–178 (from `## 3. Backups` through the `### Restore` code block, up to but not including the `---` before `## 4. Migrations`) with:

```markdown
## 3. Backups

Nightly dump of `gnosis_esoterica` → offsite copy to Backblaze B2 → mirror into an Atlas M0 cluster as a warm standby. Runs as a one-shot Docker container (`gnosis-backup`) triggered by host cron — not a daemon.

Full setup, secrets configuration, cron line, and restore-test procedure: see [`backup/README.md`](../backup/README.md).
```

- [ ] **Step 2: Update the checklist row**

In `docs/configure_db.md`, find this line (around line 193):

```markdown
| Backups | Not configured | `mongodump` cron on Pi |
```

Replace with:

```markdown
| Backups | Done | Nightly `gnosis-backup` container — see [`backup/README.md`](../backup/README.md) |
```

- [ ] **Step 3: Verify the section renders sensibly**

```bash
cd /Users/pavlos/projects/private/gnosis-esoterica-api
sed -n '140,200p' docs/configure_db.md
```

Expected: section 3 is now short, points at `backup/README.md`, section 4 (`## 4. Migrations`) immediately follows without leftover stale content, and the checklist row shows `Done`.

- [ ] **Step 4: Commit**

```bash
git add docs/configure_db.md
git commit -m "docs: point configure_db.md backups section at the new backup/ setup"
```
