# Deployment — Raspberry Pi

## Overview

The backend runs as a Docker container on a Raspberry Pi (ARM64). It is **not exposed to the host network** — only reachable by other containers on the same Docker network (`app-network`). This matches the timegnosis Next.js frontend pattern already running on the Pi.

## Architecture on the Pi

```
┌─────────────────────────────────────────────────┐
│  Raspberry Pi (host)                            │
│                                                 │
│  ┌─── docker network: app-network ───────────┐  │
│  │                                           │  │
│  │  timegnosis-next-app ──► gnosis-api:8000  │  │
│  │  (frontend, :3000)       (this backend)   │  │
│  │                               │           │  │
│  │                               ▼           │  │
│  │                          mongodb:27017    │  │
│  │                                           │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  No ports published to host = no external access│
└─────────────────────────────────────────────────┘
```

## Network Security

The key constraint: **no `ports:` mapping on the API or MongoDB containers**. Without published ports, Docker does not bind anything to the host's network interfaces, so the services are unreachable from outside the Pi.

Only the frontend (which serves the browser) publishes a port. Internal services communicate via Docker's DNS on the shared `app-network` bridge.

### What this gives you

| Concern | How it's handled |
|---|---|
| API access from outside Pi | Blocked — no host port published |
| API access from other containers | Allowed — via `app-network` DNS (`gnosis-api:8000`) |
| MongoDB access from outside Pi | Blocked — no host port published |
| MongoDB access from API container | Allowed — via `app-network` DNS (`mongodb:27017`) |

## Docker Image

### Current Dockerfile (already production-ready)

The existing `Dockerfile` uses a multi-layer approach that's good for production:

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY src/ src/
EXPOSE 8000
CMD [".venv/bin/uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

No changes needed. `python:3.12-slim` has ARM64 variants and builds cleanly with `buildx`.

### Build & push to Docker Hub

Script: `deploy-to-pi.sh` (mirrors the timegnosis pattern)

```bash
#!/bin/bash

# Deploy script for Raspberry Pi
# Usage: ./deploy-to-pi.sh [docker-hub-username]

DOCKER_USERNAME=${1:-"pavlos888"}
IMAGE_NAME="gnosis-esoterica-api"
TAG="latest"

echo "Building multi-platform image for ARM64..."
docker buildx build \
  --platform linux/arm64 \
  --tag ${DOCKER_USERNAME}/${IMAGE_NAME}:${TAG} \
  --push \
  .

echo "Image pushed to Docker Hub"
echo ""
echo "On your Raspberry Pi, run:"
echo "  docker pull ${DOCKER_USERNAME}/${IMAGE_NAME}:${TAG}"
echo "  docker compose -f docker-compose.prod.yml up -d"
```

### Prerequisites (one-time on dev machine)

```bash
# Create a buildx builder that supports ARM64 (if not already done)
docker buildx create --name pibuilder --use
docker buildx inspect --bootstrap
```

## Production Compose

File: `docker-compose.prod.yml` (runs on the Pi)

```yaml
services:
  mongodb:
    image: mongo:7
    container_name: gnosis-mongodb
    # NO ports: — not accessible from host
    volumes:
      - mongo_data:/data/db
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "bash", "-c", "</dev/tcp/127.0.0.1/27017"]
      interval: 30s
      timeout: 5s
      retries: 3

  api:
    image: pavlos888/gnosis-esoterica-api:latest
    container_name: gnosis-api
    # NO ports: — only reachable within app-network
    env_file: .env.gnosis.prod
    depends_on:
      mongodb:
        condition: service_healthy
    environment:
      - MONGODB_URI=mongodb://gnosis-mongodb:27017
    networks:
      - app-network
    restart: unless-stopped

volumes:
  mongo_data:

networks:
  app-network:
    external: true
```

### Key differences from dev compose

| | Dev (`docker-compose.yml`) | Prod (`docker-compose.prod.yml`) |
|---|---|---|
| API ports | `8001:8000` (exposed to host) | None (network-only) |
| MongoDB ports | `27019:27017` (exposed to host) | None (network-only) |
| Source mount | `./src:/app/src` + `--reload` | None — baked into image |
| Network | Default bridge | `app-network` (external, shared) |
| Restart | None | `unless-stopped` |
| Image source | `build: .` (local) | `image:` from registry |

## Environment on the Pi

File: `.env.gnosis.prod` (on the Pi, not in repo)

See `.env.gnosis.prod.example` in the repo root for the full template. Copy and fill in real values:

```bash
cp .env.gnosis.prod.example .env.gnosis.prod
```

Generate secrets:
```bash
openssl rand -hex 16  # MONGO_ROOT_PASSWORD, GNOSIS_APP_PASSWORD
openssl rand -hex 32  # JWT_SECRET_KEY
```

## Deployment Steps

### On your dev machine

```bash
chmod +x deploy-to-pi.sh
./deploy-to-pi.sh
```

### First-time setup on the Pi

```bash
# 1. Create project directory
mkdir -p ~/gnosis-esoterica && cd ~/gnosis-esoterica

# 2. SCP files from dev machine (or clone repo)
scp docker-compose.prod.yml mongo/init-user.js scripts/pi-pull-and-start.sh scripts/seed_superadmin.sh scripts/seed_superadmin.py pi@<ip>:~/gnosis-esoterica/
# (preserve mongo/ and scripts/ directory structure)

# 3. Create .env.gnosis.prod with generated secrets
cp .env.gnosis.prod.example .env.gnosis.prod
# Fill in: MONGO_ROOT_PASSWORD, GNOSIS_APP_PASSWORD, JWT_SECRET_KEY, OPENAI_API_KEY
# MONGODB_URI must embed the actual GNOSIS_APP_PASSWORD value

# 4. Pull and start (creates app-network, pulls image, runs migrations)
chmod +x scripts/pi-pull-and-start.sh
./scripts/pi-pull-and-start.sh

# 5. Seed superadmin users
chmod +x scripts/seed_superadmin.sh
./scripts/seed_superadmin.sh admin@example.com "SecurePassword123"
```

### Updating after code changes

On your dev machine:
```bash
./deploy-to-pi.sh
```

On the Pi:
```bash
cd ~/gnosis-esoterica
./scripts/pi-pull-and-start.sh
```

### Connecting the frontend

The timegnosis Next.js app reaches the API at `http://gnosis-api:8000` (Docker DNS). Set this as the API base URL in the frontend's environment.

## Verification

```bash
# On the Pi — confirm containers are running
docker ps --filter network=app-network

# Confirm API is NOT reachable from the Pi's host
curl http://localhost:8000  # should fail / connection refused

# Confirm API IS reachable from within the network
docker exec timegnosis-next-app wget -qO- http://gnosis-api:8000/api/v1/health
```

## TODO

- [x] Create `deploy-to-pi.sh` script in repo root
- [x] Create `docker-compose.prod.yml` in repo root
- [x] Create `scripts/pi-pull-and-start.sh` (pull + start + migrate)
- [x] Create `scripts/seed_superadmin.sh` + `scripts/seed_superadmin.py`
- [ ] Consider adding `--proxy-headers` to uvicorn if a reverse proxy is added later
- [ ] Set up log aggregation (stdout logs → Pi-level collection)
- [ ] Toggle register route on/off with .env - deploy first with register disabled

For MongoDB auth, backups, remote access, and migrations see [configure_db.md](./configure_db.md).
