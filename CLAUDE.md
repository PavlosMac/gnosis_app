# Gnosis Application (monorepo)

Tarot reading platform: FastAPI backend + Next.js frontend, one repo.

- `backend/` — FastAPI/uv API. Source of truth for the API contract.
- `frontend/` — Next.js app. Read `backend/CLAUDE.md` / `frontend/CLAUDE.md`
  before working in that side — they load automatically on the first file
  read under that directory, but not just from `cd`ing into it in a Bash
  call.

## Claude config

All Claude Code config lives in the root `.claude/` (settings, skills, agents,
commands). Nested `backend/.claude/` and `frontend/.claude/` hold only plain
planning docs that nothing auto-loads. Use the native `/code-review` for
reviews; there are no custom review skills.

## Env contract

The frontend reaches the backend via `GNOSIS_API_BASE_URL`, server-side only.

Dev topology: root `make dev` runs Mongo + API via `backend/docker-compose.yml`
(compose project `gnosis`; API on `http://localhost:8001`, Mongo on
`localhost:27019`) and the Next.js dev server natively on `:3000`. The Makefile
exports `GNOSIS_API_BASE_URL=http://localhost:8001` itself, so
`frontend/.env.local` (see `frontend/.env.example`) only matters for a bare
`npm run dev`. `make -C backend dev` (uvicorn on `:8000`) is a native fallback
that needs the compose Mongo up. `MONGODB_URI` has no code default: `backend/.env`
holds the host-side address (`mongodb://localhost:27019`), the compose `api`
service sets `mongodb://mongodb:27017` itself, and prod reads `.env.gnosis.prod`.

## Running tooling from the root

Bare `uv run` / `npm` at the root find no project. Use:

```bash
make -C backend <target>       # e.g. make -C backend test
npm --prefix frontend <script> # e.g. npm --prefix frontend run lint
```

Or the root `Makefile` targets (`make install`, `make dev`, `make dev-down`,
`make dev-logs`, `make test`, `make lint`, `make deploy`), which orchestrate
both sides.
