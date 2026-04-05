.PHONY: dev test lint format typecheck install docker-up docker-down migrate docker-prod-up docker-prod-down

install:
	uv sync

dev:
	uv run uvicorn src.main:app --reload --port 8000

test:
	uv run pytest -v

lint:
	uv run ruff check src/ tests/

typecheck:
	uv run pyright src/

format:
	uv run ruff format src/ tests/
	uv run ruff check --fix src/ tests/

docker-up:
	docker compose up

docker-down:
	docker compose down

migrate:
	uv run python -m src.migrations.runner

docker-prod-up:
	docker compose -f docker-compose.prod.yml up -d

docker-prod-down:
	docker compose -f docker-compose.prod.yml down
