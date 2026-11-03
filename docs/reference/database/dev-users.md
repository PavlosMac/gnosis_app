# Dev Users

## Superadmin (local dev only)

```
dev@gnosisesoterica.de
devpassword12345
```

- **Superadmin** (`is_superadmin: true`) — needed for the gated endpoints
  (`GET /api/v1/users`, `POST /api/v1/llm/interpret`).
- Seeded automatically by the dev compose `api` service command on every
  `docker compose up` (`scripts/seed_superadmin.py`, idempotent — skips if the email
  exists). It does **not** exist in production.
- Seeded with `birth_date: "1990-06-15"` (the compose command passes `--birth-date`; the script
  stores none by default, so production superadmins get no invented date) so the profile shows a card of the day. The
  seed skips an existing account, so a Mongo volume seeded before 2026-11-03 keeps its
  dateless superadmin (`make dev-down` keeps the volume). Set it by hand:

  ```
  mongosh mongodb://localhost:27019/gnosis_esoterica --eval \
    'db.users.updateOne({email: "dev@gnosisesoterica.de"}, {$set: {birth_date: "1990-06-15"}})'
  ```
- To seed outside Docker: `uv run python -m scripts.seed_superadmin <email> <password> [--birth-date YYYY-MM-DD]`. Against a running `gnosis-api` container: `scripts/seed_superadmin.sh`.
