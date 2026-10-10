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

**Required values** (the API starts without some of these, but registration cannot work):

| Variable | Why it is required |
|---|---|
| `MONGO_ROOT_PASSWORD`, `GNOSIS_APP_PASSWORD`, `MONGODB_URI` | Database access; startup fails without `MONGODB_URI`. |
| `JWT_SECRET_KEY` | Startup fails without it. |
| `OPENAI_API_KEY` | Unset selects the mock LLM. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Unset selects the console adapter: no verification or password-reset email is delivered, so nobody can complete registration. |
| `FRONTEND_BASE_URL` | Emailed links are built from it; the default is `http://localhost:3000`. Set `https://tarotdivinations.com`. |
| `SUPPORT_EMAIL` | Empty makes `POST /support/contact` answer 503. |

Optional, with defaults: `EMAIL_VERIFICATION_TOKEN_TTL_HOURS` (24),
`PENDING_ACCOUNT_TTL_DAYS` (7), the `LOGIN_`/`REGISTER_RATE_LIMIT_*` values and
`RATE_LIMIT_TRUST_FORWARDED_FOR` (true; the API has no host port and is reached only by
the Next.js container, which forwards the browser address).

### 3a. Copy and start the frontend container

The frontend is a separate image and container from the API — `docker-compose.prod.yml`
above does not include it, so it needs its own copy step or `GNOSIS_API_BASE_URL` /
`REGISTRATION_ENABLED` have nothing to come from on the Pi.

```bash
# From your dev machine:
scp frontend/docker-compose.yml ${PI}:~/projects/gnosis-esoterica/
```

If a frontend container is already running from an earlier manual `docker run` (not
compose), stop and remove it first so compose can create `tarot-next-app` cleanly:

```bash
docker ps -a --filter name=tarot
docker stop <old-container-name> && docker rm <old-container-name>
```

On the Pi, in the same directory as the backend's `docker-compose.prod.yml`:

```bash
cd ~/projects/gnosis-esoterica
docker compose -f docker-compose.yml up -d
```

### 3b. Frontend container environment

The Next.js container needs two variables. They are set in `frontend/docker-compose.yml`
in this repo:

| Variable | Value | Effect when missing |
|---|---|---|
| `GNOSIS_API_BASE_URL` | `http://gnosis-api:8000` (the API's name on `app-network`) | Every backend call fails. |
| `REGISTRATION_ENABLED` | `false` by default (closed) | Set it to exactly `true` to open sign-up. While closed, `/user/register` redirects to login and the Sign up links are hidden. |

**Sign-up is closed by default in production** (decided 2026-10-05), so deploying does
not open registration. To open it, put `REGISTRATION_ENABLED=true` in an `.env` file
beside the frontend compose file on the Pi (or export it), then recreate the container:

```bash
docker compose -f docker-compose.yml up -d --force-recreate
```

To close it again, remove the line and recreate the same way.

**`docker restart` is not enough for any env change here** — it reuses the container's
existing environment rather than re-reading the `.env` file or the compose file's
`environment:` block. Only a recreate (`up -d --force-recreate`, or removing the
container first) picks up a new value. Verify with
`docker exec tarot-next-app env | grep -E 'GNOSIS_API_BASE_URL|REGISTRATION_ENABLED'`
after recreating.

**Check the compose file actually running on the Pi.** If step 3a above was skipped and
the Pi's frontend compose was written by hand instead, add `GNOSIS_API_BASE_URL` there,
and `REGISTRATION_ENABLED` when you want sign-up open. Nothing else in the repo supplies
them.

After the first deploy of email verification, every existing user is asked to accept the
Terms and Privacy Policy once on their next visit to `/user/*`. All sessions are also
signed out once, because the session cookies were renamed to the `__Host-` form.

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
docker exec tarot-next-app wget -qO- http://gnosis-api:8000/api/v1/health
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
