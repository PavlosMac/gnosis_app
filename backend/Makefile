.PHONY: dev test lint format typecheck install docker-up docker-down migrate docker-prod-up docker-prod-down prompt-doc prompt-doc-check

install:
	uv sync

dev:
	uv run uvicorn src.main:app --reload --port 8000

test:
	uv run pytest -v

lint:
	uv run ruff check src/ tests/ scripts/

typecheck:
	uv run pyright src/ scripts/

format:
	uv run ruff format src/ tests/ scripts/
	uv run ruff check --fix src/ tests/ scripts/

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

prompt-doc:
	uv run python -m scripts.dump_prompts

prompt-doc-check:
	uv run python -m scripts.dump_prompts --check
