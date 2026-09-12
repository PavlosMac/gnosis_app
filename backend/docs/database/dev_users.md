# Dev Users

## Superadmin (local dev only)

```
dev@gnosisesoterica.dev
devpassword123
```

- **Superadmin** (`is_superadmin: true`) — needed for the gated endpoints
  (`GET /api/v1/users`, `POST /api/v1/llm/interpret`).
- Seeded automatically by the dev compose `api` service command on every
  `docker compose up` (`scripts/seed_superadmin.py`, idempotent — skips if the email
  exists). It does **not** exist in production.
- To seed outside Docker: `uv run python -m scripts.seed_superadmin <email> <password>
  [display_name]`. Against a running `gnosis-api` container: `scripts/seed_superadmin.sh`.
