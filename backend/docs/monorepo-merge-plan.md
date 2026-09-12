# Merge `gnosis-esoterica-api` and `tarot-divinations` into a monorepo

## Context

The backend (`gnosis-esoterica-api`, FastAPI/uv/Python 3.12) and frontend
(`tarot-divinations`, Next.js 16/npm) are currently separate repos that are
tightly coupled in practice (the frontend calls the backend's API as its only
data source) but developed and deployed independently. Working across both in
one Claude Code session currently means switching repos/sessions, and there's
no single command to run both in dev or deploy both to the Pi. The goal is to
combine them into one repo so both sides can be developed together, with a
single dev command, a single deploy path, combined-but-separated docs, and a
Claude Code config that gives the right context/skills/agents automatically
depending on which side you're working in.

Decisions already confirmed with the user:
- Preserve git history from both repos (via `git subtree`), not a fresh start.
- Minimal tooling: plain directories + a root Makefile, no npm workspaces /
  uv workspace / Turborepo — there's no shared code between the two stacks
  today, so a workspace linker would add ceremony with no payoff.
- Directory names: `backend/` and `frontend/`.
- Directory-scoped Claude skills stay separate per stack, not merged (e.g.
  `backend:pre-commit-review` vs `frontend:review` stay distinct — different
  checklists for different stacks, and merging them risks diluting both).
- Frontend's orphaned hooks (`protect-secrets.js`, `code-index-injector.js`,
  `post-write-regen.js`, empty `block-dangerous-commands.js`) are dropped
  entirely — never wired into a `settings.json` in the original repo, treated
  as abandoned.
- Deploy: keep the two existing `deploy-to-pi.sh` scripts and separate Docker
  images/composes; only add a root `make deploy` that runs both in sequence.
  Lowest risk to the currently-working Pi deployment.
- `make dev`: one root target that runs both dev servers concurrently in one
  terminal, output prefixed per service, a single Ctrl+C tears down both (via
  a trap in a small shell snippet — no new dependency like `concurrently` or
  `overmind`).

## Target repo layout

```
gnosis-monorepo/                     # new repo (name TBD at creation — ask user)
├── backend/                         # = current gnosis-esoterica-api, git history preserved
│   ├── CLAUDE.md                    # unchanged content
│   ├── .claude/
│   │   ├── skills/                  # execute/, pre-commit-review/ — directory-scoped
│   │   ├── prds/                    # unchanged
│   │   └── ...
│   ├── src/, tests/, docs/, scripts/, Makefile, pyproject.toml, uv.lock,
│   │   Dockerfile, docker-compose*.yml, deploy-to-pi.sh, mongo/, backup/
│   └── ...                          # everything else as-is
├── frontend/                        # = current tarot-divinations, git history preserved
│   ├── CLAUDE.md                    # unchanged content
│   ├── .claude/
│   │   └── skills/                  # review/, tarot/ — directory-scoped
│   ├── src/, docs/, public/, scripts/, package.json, next.config.ts,
│   │   Dockerfile, docker-compose.yml, deploy-to-pi.sh
│   └── ...                          # everything else as-is; drop stale AGENTS.md
│                                     # (confirm nothing else reads it first)
├── CLAUDE.md                        # NEW: thin root file — what this monorepo is,
│                                     # pointers to backend/CLAUDE.md and
│                                     # frontend/CLAUDE.md, and only genuinely
│                                     # cross-cutting rules (e.g. "backend is the
│                                     # source of truth for the API contract")
├── .claude/
│   ├── settings.json                # root-level; empty/no hooks initially
│   ├── commands/                    # union of both repos' commands (no name
│   │                                 # collisions found: api-contract, sequence,
│   │                                 # test-arc, write-plan-file, catch-up,
│   │                                 # write-plan)
│   └── agents/                      # frontend's 2 agents move here unscoped:
│                                     # code-integrity-reviewer, frontend-ux-expert
│                                     # (no backend equivalents to conflict with)
├── docs/
│   └── README.md                    # NEW: top-level index linking into
│                                     # backend/docs/ and frontend/docs/ (docs
│                                     # stay physically inside each dir, not moved)
├── Makefile                         # NEW: root orchestration only (see below)
└── (no root deploy script — `make deploy` calls into each dir's script)
```

## Root Makefile (new, orchestration only — sub-Makefiles/package.json untouched)

```makefile
.PHONY: dev test lint install deploy

install:
	$(MAKE) -C backend install
	cd frontend && npm ci

dev:
	# runs both concurrently, prefixed output, single Ctrl+C kills both
	@trap 'kill 0' EXIT INT TERM; \
	( $(MAKE) -C backend dev 2>&1 | sed 's/^/[backend] /' ) & \
	( cd frontend && npm run dev 2>&1 | sed 's/^/[frontend] /' ) & \
	wait

test:
	$(MAKE) -C backend test
	cd frontend && npm test

lint:
	$(MAKE) -C backend lint
	cd frontend && npm run lint

deploy:
	cd backend && ./deploy-to-pi.sh
	cd frontend && ./deploy-to-pi.sh
```

Each existing Makefile/`package.json` script set stays as the actual
implementation; the root Makefile is a thin dispatcher. Need to verify during
implementation whether either `deploy-to-pi.sh` assumes it's run from the
original repo root (paths, docker build context) — adjust internal relative
paths if so, but keep external behavior (image names, Pi target) identical.

## CLAUDE.md / Claude config merge (the delicate part)

Claude Code loads the CLAUDE.md nearest the working directory plus the root
one, and already supports directory-scoped skills (shown in this session's
own skill listing as `path:skill-name`). The merge plan leans on that:

- **Root `CLAUDE.md`** (new, short): identifies the monorepo, the two dirs,
  links to each side's CLAUDE.md, states only rules that span both sides
  (e.g. API-contract ownership, env var contract like `GNOSIS_API_BASE_URL`).
- **`backend/CLAUDE.md`** and **`frontend/CLAUDE.md`**: carried over verbatim
  — no changes needed since all paths referenced inside them are relative to
  their own dir, which doesn't change.
- **Skills**: stay directory-scoped inside `backend/.claude/skills/` and
  `frontend/.claude/skills/` — no merging of `pre-commit-review` and `review`,
  per user decision. This means when Claude is asked to review changes while
  working in `frontend/`, `frontend:review` naturally wins; same for backend.
- **Commands**: move to root `.claude/commands/` (commands aren't
  directory-scoped the same way) — verified no filename collisions between
  the two repos' command sets.
- **Agents**: frontend's `code-integrity-reviewer.md` and
  `frontend-ux-expert.md` move to root `.claude/agents/` (backend has none
  today, so no conflict).
- **Hooks**: none carried over (frontend's were unwired/abandoned; backend
  has none). Root `.claude/settings.json` starts empty, matching backend's
  current state.
- **Process/memory artifacts** (`backend/.claude/prds/`, frontend's
  `docs/project_notes/*`, `project.md`, `requirements.md`) stay where they
  are, untouched — they're per-project working state, not shared config.
- Drop frontend's stale `AGENTS.md` (outdated duplicate of its CLAUDE.md) —
  confirm first that nothing outside Claude Code (e.g. another AI tool)
  depends on it before deleting.

## Git history preservation

Using `git subtree` so both projects' commit history is preserved and
interleaved into one timeline:

```bash
mkdir gnosis-monorepo && cd gnosis-monorepo && git init

git remote add backend-origin /Users/pavlos/projects/gnosis-esoterica-api
git fetch backend-origin
git subtree add --prefix=backend backend-origin main

git remote add frontend-origin /Users/pavlos/projects/tarot-divinations
git fetch frontend-origin
git subtree add --prefix=frontend frontend-origin main
```

(Exact commands to be finalized/tested during implementation — `git subtree`
behavior varies slightly with local-path remotes vs URL remotes, worth a dry
run in a scratch dir first.) After this, `git log --follow -- backend/src/main.py`
should still show the original repo's history for that file.

## Verification

1. `make install` succeeds from monorepo root (installs both).
2. `make dev` starts both servers, logs interleave with `[backend]`/
   `[frontend]` prefixes, and a single Ctrl+C stops both processes (check no
   orphaned `uvicorn`/`next dev` process remains — `ps aux | grep -E
   'uvicorn|next dev'`).
3. `make test` runs backend pytest suite and frontend vitest suite, both
   green (matching their current standalone pass/fail state).
4. `make lint` runs both linters clean (matching current state).
5. Open Claude Code at the monorepo root, `cd` into `backend/` in a
   conversation and confirm `backend/CLAUDE.md` + backend skills
   (`pre-commit-review`, `execute`) are the ones offered; same check for
   `frontend/` with its skills (`review`, `tarot`) and its 2 agents visible
   globally.
6. `git log --follow` on a file that existed in each original repo before
   the merge (e.g. `backend/src/main.py`, `frontend/src/proxy.ts`) shows
   pre-merge commits.
7. `make deploy` (dry-run / read the script output, don't actually deploy
   during verification) confirms it calls both original deploy scripts in
   the right order with unchanged image names.

## Open items for the user before/at implementation time

- New repo name (e.g. `gnosis-monorepo`, `tarot-app`, other) and whether it
  starts as a fresh GitHub repo or reuses one of the existing two repo slots.
- Confirm nothing depends on frontend's `AGENTS.md` before deleting it.
- Decide whether the two old repos are archived/deleted after the merge, or
  kept around read-only as a fallback for a while.
