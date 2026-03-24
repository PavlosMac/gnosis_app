.PHONY: dev test lint format install docker-up docker-down

install:
	uv sync

dev:
	uv run uvicorn src.main:app --reload --port 8000

test:
	uv run pytest -v

lint:
	uv run ruff check src/ tests/

format:
	uv run ruff format src/ tests/
	uv run ruff check --fix src/ tests/

docker-up:
	docker compose up -d

docker-down:
	docker compose down
