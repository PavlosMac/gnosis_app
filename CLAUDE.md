# Gnosis Application (monorepo)

Tarot reading platform: FastAPI backend + Next.js frontend, one repo.

- `backend/` — FastAPI/uv API. Source of truth for the API contract.
- `frontend/` — Next.js app. Read `backend/CLAUDE.md` / `frontend/CLAUDE.md`
  before working in that side — they load automatically on the first file
  read under that directory, but not just from `cd`ing into it in a Bash
  call.

## Env contract

The frontend reaches the backend via `GNOSIS_API_BASE_URL`.

## Running tooling from the root

Bare `uv run` / `npm` at the root find no project. Use:

```bash
make -C backend <target>       # e.g. make -C backend test
npm --prefix frontend <script> # e.g. npm --prefix frontend run lint
```

Or the root `Makefile` targets (`make install`, `make dev`, `make test`,
`make lint`, `make deploy`), which orchestrate both sides.
