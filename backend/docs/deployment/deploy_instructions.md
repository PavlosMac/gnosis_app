# Deploy Instructions

## Dev Machine — Build & Push

```bash
# One-time: create a buildx builder for ARM64
docker buildx create --name pibuilder --use
docker buildx inspect --bootstrap

# Build and push ARM64 image to Docker Hub
./deploy-to-pi.sh
```

## Pi — First-Time Setup

### 1. Create project directory

```bash
mkdir -p ~/projects/gnosis-esoterica/mongo ~/projects/gnosis-esoterica/scripts
cd ~/projects/gnosis-esoterica
```

### 2. Copy files from dev machine

```bash
# From your dev machine:
PI=pi@<pi-ip>

scp docker-compose.prod.yml ${PI}:~/projects/gnosis-esoterica/
scp .env.gnosis.prod.example ${PI}:~/projects/gnosis-esoterica/
scp mongo/init-user.js ${PI}:~/projects/gnosis-esoterica/mongo/
scp scripts/pi-pull-and-start.sh scripts/seed_superadmin.sh scripts/seed_superadmin.py scripts/pi-mongo.sh ${PI}:~/projects/gnosis-esoterica/scripts/
```

### 3. Create `.env.gnosis.prod`

On the Pi:

```bash
cd ~/projects/gnosis-esoterica
cp .env.gnosis.prod.example .env.gnosis.prod
```

Generate secrets and paste them into the file:

```bash
openssl rand -hex 16  # → MONGO_ROOT_PASSWORD
openssl rand -hex 16  # → GNOSIS_APP_PASSWORD
openssl rand -hex 32  # → JWT_SECRET_KEY
```

Edit `.env.gnosis.prod` — fill in the generated values and your OpenAI key. The `MONGODB_URI` must embed the actual `GNOSIS_APP_PASSWORD` value (not the placeholder):

```
MONGODB_URI=mongodb://gnosis_app:<paste-GNOSIS_APP_PASSWORD-here>@gnosis-mongodb:27017/gnosis_esoterica?authSource=gnosis_esoterica
```

### 4. Pull, start, and migrate

```bash
chmod +x scripts/pi-pull-and-start.sh scripts/seed_superadmin.sh
./scripts/pi-pull-and-start.sh
```

This will:
- Create `app-network` if it doesn't exist
- Pull the latest image from Docker Hub
- Start MongoDB + API containers
- Wait for the API to be ready
- Run database migrations

### 5. Seed superadmin users

```bash
./scripts/seed_superadmin.sh superadmin1@glee.com "MylovelyHorse112"
./scripts/seed_superadmin.sh superadmin2@glee.com "WhataDayonthePrairie324!"
```

### 6. Verify

```bash
# All containers running on app-network
docker ps --filter network=app-network

# API should NOT be reachable from host
curl http://localhost:8000  # expect: connection refused

# API should be reachable from within the network
docker exec timegnosis-next-app wget -qO- http://gnosis-api:8000/api/v1/health
```

## Pi — Subsequent Updates

On your dev machine:

```bash
./deploy-to-pi.sh
```

On the Pi:

```bash
cd ~/projects/gnosis-esoterica
./scripts/pi-pull-and-start.sh
```

Migrations run automatically on each pull-and-start (they're idempotent).
