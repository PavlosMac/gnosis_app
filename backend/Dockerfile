FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Pinned on purpose: `latest` would let a retargeted tag change the build silently.
# Bump deliberately (docs/notes/security-watchlist.md, item I2).
COPY --from=ghcr.io/astral-sh/uv:0.13.7 /uv /uvx /bin/

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY src/ src/

# Run unprivileged: a compromised process cannot write outside /app or install anything.
# The app writes no files under /app. The dev compose bind-mounts ./src and ./scripts with host
# ownership: uvicorn --reload and the seed script only read them, and Python skips a __pycache__
# it cannot write.
RUN groupadd --system --gid 1001 api \
    && useradd --system --uid 1001 --gid api --no-create-home api \
    && chown -R api:api /app
USER api

EXPOSE 8000

CMD [".venv/bin/uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
