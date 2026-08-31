# MongoDB Backup — Design

## Context

- MongoDB (`gnosis-mongodb`) runs as a Docker container on the Raspberry Pi (Pi 5), on the `app-network` bridge, database `gnosis_esoterica`. No host port is published — only reachable from other containers on `app-network` (see `docs/deployment.md`).
- Auth is enabled: root user `gnosis_admin` (authSource `admin`) + scoped app user `gnosis_app` (see `docs/configure_db.md`).
- Dataset is small (< 1 GB), low write volume.
- Goal: one scheduled job that (a) dumps the DB to a compressed local archive, (b) ships that archive off the Pi to an existing Backblaze B2 bucket, and (c) mirrors the data into an existing MongoDB Atlas M0 cluster as a warm standby.
- Runs as a **one-shot Docker container** invoked by host cron (a task, not a daemon) — matches the existing `pi-pull-and-start.sh` / deploy pattern already used on this Pi.
- On failure, post a message to a Discord webhook naming which step failed. Stay silent on success.

This supersedes the earlier draft in `docs/data_backups.md`, which assumed DB name `gnosis` (actual: `gnosis_esoterica`), no auth, and `--network host` / `localhost:27017` (actual: `app-network` / `gnosis-mongodb:27017`), and had no failure notification.

## Architecture

- Backup container joins `app-network` (not `--network host`) and reaches Mongo via Docker DNS at `gnosis-mongodb:27017`.
- Triggered nightly by a host crontab entry; container exits after one run.
- Credentials (Mongo, Atlas, B2/rclone, Discord webhook) live only in a `600`-perms env file on the Pi, never in the image or repo.
- B2 bucket and Atlas M0 cluster already exist — this work only wires the script/container/cron to them, no account provisioning.
- Atlas network access: `0.0.0.0/0` allow-listed, security relies on strong Atlas credentials (already generated). No dynamic-IP tracking needed.

## Script flow (`backup/backup-to-atlas.sh`)

1. **Dump** — `mongodump --archive=<file> --gzip --uri="mongodb://gnosis_admin:<pw>@gnosis-mongodb:27017/gnosis_esoterica?authSource=admin"`, timestamped filename.
2. **Offsite copy** — `rclone copy <file> <B2_REMOTE>/`.
3. **Atlas mirror** — `mongorestore --uri="$ATLAS_URI" --archive=<file> --gzip --drop` (drop before restore so deletions on the Pi are reflected, true mirror not append-only).
4. **Local retention** — keep the last 7 archives, delete older.
5. **Failure notify** — `set -Eeuo pipefail` (the `-E` is required so the trap fires inside functions) + `trap 'notify_failure "$STEP"' ERR`, where `$STEP` tracks which stage (dump/upload/mirror) was in progress. On trap, POST one message to the Discord webhook (`{"content": "..."}`) naming the failed step and the log line, then exit non-zero. Success path posts nothing.
6. Cron redirects stdout/stderr to a log file on the Pi as a secondary record, independent of the Discord alert.

## Deliverables

```
backup/
├── backup-to-atlas.sh        # dump -> B2 -> Atlas mirror -> Discord-on-failure
├── Dockerfile                 # debian:bookworm-slim + rclone (apt) + mongodb-database-tools (Ubuntu 22.04 arm64 tarball — MongoDB ships no Debian arm64 build; the glibc binaries run fine on Debian 12 with libgssapi-krb5-2/libssl3/libsasl2-2 installed)
├── .mongo-backup.env.example  # template for secrets (never commit the real file)
└── README.md                  # build, configure secrets, install cron, run a restore test
```

`.mongo-backup.env.example`:
```bash
export MONGO_URI="mongodb://gnosis_admin:<root-password>@gnosis-mongodb:27017/gnosis_esoterica?authSource=admin"
export ATLAS_URI="mongodb+srv://user:<password>@cluster.mongodb.net/"
export B2_REMOTE="b2:gnosis-backups"
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
export BACKUP_DIR="/home/pi/mongo-backups"
```

Run command (documented in README):
```bash
docker run --rm \
  --network app-network \
  --env-file /home/pi/.mongo-backup.env \
  -v /home/pi/mongo-backups:/home/pi/mongo-backups \
  gnosis-backup
```

Cron line (documented in README):
```
0 3 * * * docker run --rm --network app-network --env-file /home/pi/.mongo-backup.env -v /home/pi/mongo-backups:/home/pi/mongo-backups gnosis-backup >> /home/pi/mongo-backups/backup.log 2>&1
```

rclone config: one-time interactive `rclone config` on the Pi host to create the B2 remote; mount the host's `~/.config/rclone` read-only into the container rather than baking credentials into the image.

## Error handling & verification

- `set -Eeuo pipefail` + `ERR` trap posts exactly one Discord message per failing run, naming the step that failed. `-E` (`errtrace`) is required — without it, bash's `ERR` trap does not fire for failures inside shell functions.
- Restore-test (manual, documented in README, not automated):
  ```bash
  mongorestore --archive=<file> --gzip --nsFrom='gnosis_esoterica.*' --nsTo='gnosis_esoterica_test.*' \
    --uri="mongodb://gnosis_admin:<root-password>@gnosis-mongodb:27017/?authSource=admin"
  ```
  then compare doc counts between source and `gnosis_esoterica_test`.
- Secrets only ever live in the `600`-perms env file or mounted rclone config — never in the image, repo, or committed anywhere. Note: `mongodump --uri=...` and `mongorestore --uri=...` take the credential as a CLI flag, which is visible in the container's process list; this is accepted as a minor exposure window since the Pi's process list is only visible to root.

## Acceptance criteria

- `docker run --rm gnosis-backup mongodump --version` runs cleanly on the Pi 5 (no illegal-instruction crash).
- A manual run produces `gnosis_esoterica-<stamp>.archive.gz` locally, uploads it to B2, and the Atlas cluster shows the current collections afterward.
- Simulating a failure (e.g. temporarily breaking network access or pointing at an invalid webhook URL) confirms the Discord alert actually fires and names the right step.
- `--drop` is present on the Atlas restore.
- Restore-test into `gnosis_esoterica_test` produces matching doc counts against the source.

## Out of scope

- Provisioning the B2 bucket or Atlas cluster (both already exist).
- Automated restore-test as part of the nightly job — restore verification stays a manual/documented procedure.
- Dynamic IP tracking / Atlas allowlist automation.
- Pi 4 / legacy ARM tooling support (this Pi is a Pi 5).
