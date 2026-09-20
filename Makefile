COMPOSE := docker compose -f backend/docker-compose.yml
API_URL := http://localhost:8001

.PHONY: install dev dev-down dev-logs test lint deploy

install:
	$(MAKE) -C backend install
	cd frontend && npm ci

dev:
	# Mongo + API via compose (API on :8001, Mongo on :27019); frontend native
	# so Turbopack hot reload keeps working. `--wait` blocks until both
	# containers are healthy, so the frontend never starts against a dead API.
	# GNOSIS_API_BASE_URL is exported here and beats frontend/.env.local.
	# Ctrl+C stops the containers (volume is kept); `make dev-down` removes them.
	$(COMPOSE) up -d --build --wait --wait-timeout 120
	@trap 'kill $$LOGS 2>/dev/null; $(COMPOSE) stop' EXIT; trap 'exit 130' INT TERM; \
	$(COMPOSE) logs -f --tail=50 api & LOGS=$$!; \
	cd frontend && GNOSIS_API_BASE_URL=$(API_URL) npm run dev

dev-down:
	$(COMPOSE) down

dev-logs:
	$(COMPOSE) logs -f api

test:
	$(MAKE) -C backend test
	cd frontend && npm test

lint:
	$(MAKE) -C backend lint
	cd frontend && npm run lint

deploy:
	cd backend && ./deploy-to-pi.sh
	cd frontend && ./deploy-to-pi.sh
