#!/bin/bash
set -euo pipefail

# Pull latest image, start containers, and run migrations on the Raspberry Pi.
# Usage: ./scripts/pi-pull-and-start.sh
# Expects .env.gnosis.prod and docker-compose.prod.yml in the current directory.

ENV_FILE=".env.gnosis.prod"
COMPOSE_FILE="docker-compose.prod.yml"
API_CONTAINER="gnosis-api"
NETWORK="app-network"

if [ ! -f "${ENV_FILE}" ]; then
  echo "ERROR: ${ENV_FILE} not found in $(pwd)"
  echo "Copy .env.gnosis.prod.example and fill in your secrets."
  exit 1
fi

if [ ! -f "${COMPOSE_FILE}" ]; then
  echo "ERROR: ${COMPOSE_FILE} not found in $(pwd)"
  exit 1
fi

# Create app-network if it doesn't exist
if ! docker network inspect "${NETWORK}" >/dev/null 2>&1; then
  echo "==> Creating Docker network: ${NETWORK}"
  docker network create "${NETWORK}"
fi

echo "==> Pulling latest images..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" pull

echo "==> Starting containers..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d

echo "==> Waiting for API container to be ready..."
RETRIES=30
until docker exec "${API_CONTAINER}" echo "ready" >/dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ "${RETRIES}" -le 0 ]; then
    echo "ERROR: API container did not start in time."
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" logs api
    exit 1
  fi
  sleep 2
done

echo "==> Running migrations..."
docker exec "${API_CONTAINER}" .venv/bin/python -m src.migrations.runner

echo ""
echo "==> Deployment complete!"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps
