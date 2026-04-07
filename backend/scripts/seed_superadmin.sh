#!/bin/bash
set -euo pipefail

# Seed a superadmin user in the API container.
# Usage: ./scripts/seed_superadmin.sh <email> <password> [display_name]

API_CONTAINER="gnosis-api"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SEED_SCRIPT="seed_superadmin.py"

if [ $# -lt 2 ]; then
  echo "Usage: $0 <email> <password> [display_name]"
  exit 1
fi

EMAIL="$1"
PASSWORD="$2"
DISPLAY_NAME="${3:-}"

echo "==> Copying seed script into container..."
docker exec "${API_CONTAINER}" mkdir -p /app/scripts
docker cp "${SCRIPT_DIR}/${SEED_SCRIPT}" "${API_CONTAINER}:/app/scripts/${SEED_SCRIPT}"

echo "==> Seeding superadmin: ${EMAIL}"
if [ -n "${DISPLAY_NAME}" ]; then
  docker exec "${API_CONTAINER}" .venv/bin/python -m scripts.seed_superadmin "${EMAIL}" "${PASSWORD}" "${DISPLAY_NAME}"
else
  docker exec "${API_CONTAINER}" .venv/bin/python -m scripts.seed_superadmin "${EMAIL}" "${PASSWORD}"
fi

echo "==> Cleaning up..."
docker exec "${API_CONTAINER}" rm -f /app/scripts/${SEED_SCRIPT}

echo "==> Done."
