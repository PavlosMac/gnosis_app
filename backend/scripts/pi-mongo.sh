#!/usr/bin/env bash
# Runs from your Mac OR on the Pi. Opens mongosh inside the gnosis-mongodb container as gnosis_admin.
#   scripts/pi-mongo.sh                              -> interactive shell on gnosis_esoterica
#   scripts/pi-mongo.sh 'db.users.countDocuments()'  -> run one expression and exit
#   scripts/pi-mongo.sh --file query.js              -> run a local script (streamed over ssh)
#
# From the Mac it ssh's to $PI_HOST and runs the Pi copy at $PI_SCRIPT. Keep the Pi copy in sync:
#   scp scripts/pi-mongo.sh pavlos-mk@pavspi.local:~/projects/gnosis-esoterica/scripts/
set -euo pipefail

PI_HOST="${PI_HOST:-pavlos-mk@pavspi.local}"
PI_DIR="${PI_DIR:-~/projects/gnosis-esoterica}"
PI_SCRIPT="${PI_SCRIPT:-$PI_DIR/scripts/pi-mongo.sh}"
# On the Pi: .env.gnosis.prod sits in the project dir, one level above this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/../.env.gnosis.prod}"
CONTAINER="${CONTAINER:-gnosis-mongodb}"
DB="${DB:-gnosis_esoterica}"

# --- Mac side: hop to the Pi -------------------------------------------------
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ "${1:-}" == "--file" ]]; then
    # stream the local file over stdin; remote reads "--file -"
    ssh "$PI_HOST" "DB=$(printf %q "$DB") $PI_SCRIPT --file -" < "$2"
  elif [[ $# -gt 0 ]]; then
    ssh "$PI_HOST" "DB=$(printf %q "$DB") $PI_SCRIPT $(printf '%q ' "$@")"
  else
    ssh -t "$PI_HOST" "DB=$(printf %q "$DB") $PI_SCRIPT"
  fi
  exit $?
fi

# --- Pi side ------------------------------------------------------------------
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${MONGO_ROOT_PASSWORD:?MONGO_ROOT_PASSWORD missing in $ENV_FILE}"
URI="mongodb://gnosis_admin:${MONGO_ROOT_PASSWORD}@localhost:27017/${DB}?authSource=admin"

if [[ "${1:-}" == "--file" ]]; then
  if [[ "$2" == "-" ]]; then
    docker exec -i "$CONTAINER" mongosh --quiet "$URI"
  else
    docker exec -i "$CONTAINER" mongosh --quiet "$URI" < "$2"
  fi
elif [[ $# -gt 0 ]]; then
  docker exec "$CONTAINER" mongosh --quiet "$URI" --eval "$*"
else
  docker exec -it "$CONTAINER" mongosh "$URI"
fi
