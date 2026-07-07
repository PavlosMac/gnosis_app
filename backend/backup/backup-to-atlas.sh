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
