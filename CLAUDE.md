# Gnosis Application (monorepo)

Tarot reading platform: FastAPI backend + Next.js frontend, one repo.

- `backend/` — FastAPI/uv API. Source of truth for the API contract.
- `frontend/` — Next.js app. Read `backend/CLAUDE.md` / `frontend/CLAUDE.md`
  before working in that side — they load automatically on the first file
  read under that directory, but not just from `cd`ing into it in a Bash
  call.

## Claude config

All Claude Code config lives in the root `.claude/` (settings, skills, agents,
commands). There are no nested `.claude/` folders. Use the native `/code-review`
for reviews; there are no custom review skills.

## Docs

One tree, `docs/`, sorted by status first. Full index with one line per doc:
[`docs/README.md`](docs/README.md).

- `docs/reference/` — **how it works**. Must match the code; change it in the same PR
  as the code it describes.
- `docs/plans/` — **not built yet**. `YYYY-MM-DD-<topic>.md`, `Status:` on the first
  lines. When a plan ships: update or create the reference doc, then delete the plan.
  Specs and plans from the brainstorming / writing-plans skills go here, never to
  `docs/superpowers/`.
- `docs/notes/` — **living logs**: decisions (ADRs), bugs, issues (work log), key facts,
  known risks.

Filenames and folders are kebab-case (`README.md` is the only exception). Nothing else
under `backend/` or `frontend/` is documentation except `frontend/src/content/legal/README.md`
and the two side `CLAUDE.md` files. `make docs-check` verifies every relative link in
`docs/` and the three `CLAUDE.md` files; CI runs it.

### Working on → read first

| Working on | Read first |
|---|---|
| Registration, login, verification, consent, deletion | [`registration-verification-and-consent.md`](docs/reference/auth/registration-verification-and-consent.md) (backend), [`frontend-auth-flow.md`](docs/reference/auth/frontend-auth-flow.md) (frontend), QA script [`registration-qa-checklist.md`](docs/reference/auth/registration-qa-checklist.md) |
| Collections, fields, indexes, migrations | [`model-references.md`](docs/reference/database/model-references.md), [`db-migrations.md`](docs/reference/database/db-migrations.md) |
| Interpretations, LLM calls, usage and budget | [`usage-and-budget-flow.md`](docs/reference/interpretations/usage-and-budget-flow.md), [`user-accounting.md`](docs/reference/interpretations/user-accounting.md) |
| Prompts | [`lean-prompt-architecture.md`](docs/reference/prompts/lean-prompt-architecture.md), [`prompt-reference.md`](docs/reference/prompts/prompt-reference.md) (generated: `make -C backend prompt-doc`) |
| Readings, tags, search | [`search-and-tags.md`](docs/reference/readings/search-and-tags.md) |
| Free-use limit, sign-up nudge | [`free-limit-cta.md`](docs/reference/readings/free-limit-cta.md) |
| Email: reset, verification, support relay | [`email-service.md`](docs/reference/email/email-service.md) |
| Guide chapters, screenshots | [`user-guide.md`](docs/reference/guide/user-guide.md) |
| Contact support | [`contact-support.md`](docs/reference/support/contact-support.md) |
| Legal pages, consent versions | [`frontend/src/content/legal/README.md`](frontend/src/content/legal/README.md) |
| Local Mongo, dev superadmin | [`configure-db.md`](docs/reference/database/configure-db.md), [`dev-users.md`](docs/reference/database/dev-users.md) |
| Deploying, prod Mongo, backups | [`deploy-instructions.md`](docs/reference/deployment/deploy-instructions.md), [`production-mongo-commands.md`](docs/reference/database/production-mongo-commands.md), [`mongodb-backup.md`](docs/reference/deployment/mongodb-backup.md) |
| Why something is the way it is | [`decisions.md`](docs/notes/decisions.md) (ADRs) |
| Ports, URLs, env flags, accounts | [`key-facts.md`](docs/notes/key-facts.md) |
| Known bugs and open risks | [`bugs.md`](docs/notes/bugs.md), [`known-risks.md`](docs/notes/known-risks.md) |
| What is planned but not built | [`docs/plans/`](docs/plans/) — one file per plan, status at the top |

### Project notes protocol

- **Before proposing architectural changes**: check `docs/notes/decisions.md`. If the
  proposal conflicts with an ADR, say so and explain why a change is warranted.
- **When hitting a bug**: search `docs/notes/bugs.md` first; log new bugs and their fix
  there when resolved (symptom, cause, fix, prevention).
- **When looking up configuration**: prefer `docs/notes/key-facts.md` over assumptions.
- **When completing work**: add a dated line to `docs/notes/issues.md` (what, status).
- **When shipping a plan**: update or create the reference doc, delete the plan, update
  `docs/README.md` and, if a new area, the table above.
- Follow the existing format of each file: bullet lists, dates, concise entries.

## Env contract

The frontend reaches the backend via `GNOSIS_API_BASE_URL`, server-side only.

Dev topology: root `make dev` runs Mongo + API via `backend/docker-compose.yml`
(compose project `gnosis`; API on `http://localhost:8001`, Mongo on
`localhost:27019`) and the Next.js dev server natively on `:3000`. The Makefile
exports `GNOSIS_API_BASE_URL=http://localhost:8001` and `REGISTRATION_ENABLED=true` itself, so
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
