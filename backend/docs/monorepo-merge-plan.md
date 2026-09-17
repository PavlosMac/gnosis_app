# Merge `gnosis-esoterica-api` and `tarot-divinations` into a monorepo

Revised 2026-09-16 after a risk review (two dry runs + Claude Code docs check).
Changes from the first draft are marked **[revised]**.

## Context

The backend (`gnosis-esoterica-api`, FastAPI/uv/Python 3.12) and frontend
(`tarot-divinations`, Next.js 16/npm) are separate repos that are tightly
coupled in practice (the frontend calls the backend's API as its only data
source) but developed and deployed independently. Working across both in one
Claude Code session means switching repos/sessions, and there's no single
command to run both in dev or deploy both to the Pi. The goal is one repo so
both sides can be developed together, with a single dev command, a single
deploy path, combined-but-separated docs, and a Claude Code config that gives
the right context/skills automatically depending on which side you're in.

## Decisions confirmed with the user

- **New repo is `/Users/pavlos/projects/gnosis_application`** (already created,
  empty, not yet `git init`ed). **[revised]**
- **Copy, never move.** The two original repos are not modified, deleted or
  archived as part of this work. Everything is built from throwaway clones.
  Archiving the old repos is a later, separate decision. **[revised]**
- **History via `git filter-repo`, not `git subtree`.** A dry run showed
  `subtree add` keeps the commits but breaks path-based queries:
  `git log -- backend/` shows only the merge commit and `git log --follow` on
  a backend file returns nothing. Rewriting each clone with
  `--to-subdirectory-filter` first, then merging, gives full history under
  each folder (86/86 backend commits, 20/20 for `src/main.py`, no `--follow`
  needed). Commit hashes change; that is accepted. **[revised]**
- **Source is each repo's `main`.** Unmerged branches and the backend stash are
  ignored — they will be merged before this runs. **[revised]**
- Minimal tooling: plain directories + a root Makefile, no npm workspaces / uv
  workspace / Turborepo — no shared code between the two stacks today.
- Directory names: `backend/` and `frontend/`.
- Directory-scoped Claude skills stay separate per stack, not merged.
- Frontend's orphaned hooks (`protect-secrets.js`, `code-index-injector.js`,
  `post-write-regen.js`, empty `block-dangerous-commands.js`) are dropped —
  never wired into `settings.json`, treated as abandoned.
- **`frontend/CONTEXT_ENGINEERING.md` is kept.** It documents the hooks/ctags
  code-index workflow; the user wants to revisit and refine that workflow
  (code index + new tags) as a follow-up project after the merge. **[revised]**
- Frontend's `AGENTS.md` is dropped: nothing in the repo references it and no
  other AI-tool config (`.cursor`, `.codex`, etc.) exists. **[revised: confirmed]**
- **Lazy CLAUDE.md loading is accepted.** Claude Code loads `backend/CLAUDE.md`
  only when it first reads a file under `backend/`; a `cd backend` in a Bash
  call does not trigger it. Root `CLAUDE.md` stays thin with no `@imports`.
  **[revised]**
- Deploy: keep the two existing `deploy-to-pi.sh` scripts and separate Docker
  images/composes; add a root `make deploy` that runs both in sequence.
- `make dev`: one root target that runs both dev servers concurrently, output
  prefixed per service, single Ctrl+C tears down both, no new dependency.
- Nothing generated or vendored is copied: `node_modules/`, `.venv/`, `.next/`,
  caches. Tracked files come via git; only the two env files are copied by
  hand (see "Local-only state"). **[revised]**

## Target repo layout

```
gnosis_application/
├── backend/                         # = gnosis-esoterica-api main, history rewritten under this prefix
│   ├── CLAUDE.md                    # unchanged
│   ├── .claude/
│   │   ├── skills/                  # execute/, pre-commit-review/ — directory-scoped
│   │   └── prds/                    # unchanged
│   │   (settings.json removed — see Claude config section)
│   ├── src/, tests/, docs/, scripts/, Makefile, pyproject.toml, uv.lock,
│   │   Dockerfile, docker-compose*.yml, deploy-to-pi.sh, mongo/, backup/
│   │   (.github/ removed — workflow moves to root)
│   └── ...
├── frontend/                        # = tarot-divinations main, history rewritten under this prefix
│   ├── CLAUDE.md                    # unchanged
│   ├── CONTEXT_ENGINEERING.md       # kept (follow-up: refine workflow)
│   ├── .claude/
│   │   ├── skills/                  # review/, tarot/ — directory-scoped
│   │   ├── project.md, requirements.md   # unchanged
│   │   (agents/, commands/, hooks/, settings.json removed — see below)
│   ├── src/, docs/, public/, scripts/, package.json, next.config.ts,
│   │   Dockerfile, docker-compose.yml, deploy-to-pi.sh
│   └── ...                          # AGENTS.md dropped
├── CLAUDE.md                        # NEW: thin root file (see below)
├── .claude/
│   ├── settings.json                # NEW: deny rules lifted from both repos
│   ├── commands/                    # union: api-contract, sequence, test-arc,
│   │                                #   write-plan-file (backend) + catch-up, write-plan (frontend)
│   └── agents/                      # code-integrity-reviewer, frontend-ux-expert (from frontend)
├── .github/workflows/ci.yml         # NEW location: backend CI, path-filtered
├── .gitignore                       # NEW: root-only ignores (.DS_Store, .idea, .vscode)
├── docs/README.md                   # NEW: index linking into backend/docs/ and frontend/docs/
└── Makefile                         # NEW: root orchestration only
```

Subdirectory `.gitignore`, `.dockerignore`, `pyproject.toml`, `tsconfig.json`,
etc. keep working unchanged because every path inside them is relative to
its own directory.

## Root Makefile (orchestration only)

```makefile
.PHONY: install dev test lint deploy

install:
	$(MAKE) -C backend install
	cd frontend && npm ci

dev:
	# both servers, prefixed output, one Ctrl+C stops both.
	# sed -l = line-buffered (BSD sed on macOS; GNU sed would be -u).
	@trap 'kill 0' EXIT INT TERM; \
	( $(MAKE) -C backend dev 2>&1 | sed -l 's/^/[backend] /' ) & \
	( cd frontend && npm run dev 2>&1 | sed -l 's/^/[frontend] /' ) & \
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

Notes **[revised]**:
- `make dev` is untested; the `kill 0` on EXIT also kills make itself, so a
  cosmetic "Terminated" line is expected. Tune during implementation; the
  requirement is only "no orphaned `uvicorn`/`next dev` after Ctrl+C".
- Both `deploy-to-pi.sh` scripts were checked: each uses `.` as the build
  context and assumes nothing about a repo root, so `cd <dir> && ./deploy-to-pi.sh`
  is enough. Image names (`pavlos888/gnosis-esoterica-api`,
  `pavlos888/tarot-nextjs`) are unchanged. The Pi keeps its own
  `~/projects/gnosis-esoterica` directory fed by `scp`, so nothing on the Pi
  goes stale.
- Frontend's `deploy-to-pi.sh` has no `set -e` and prints "Image pushed" even
  when the build fails. Add `set -euo pipefail` to match the backend script.
- `.pre-commit-config.yaml` stays in `backend/` for now. It is not installed
  as a git hook locally, so nothing breaks. If pre-commit is re-enabled it
  must move to root with `files: ^backend/`.

## Claude config merge

Verified against the Claude Code docs (memory, skills, permissions, settings):

- **Root `CLAUDE.md`** (new, short): what the monorepo is, the two dirs, links
  to each side's `CLAUDE.md`, and only cross-cutting rules:
  - backend is the source of truth for the API contract;
  - env contract: frontend reaches the backend via `GNOSIS_API_BASE_URL`;
  - from the root, run tooling as `make -C backend <target>` and
    `npm --prefix frontend <script>` (bare `uv run` / `npm` at root find no
    project) **[revised]**;
  - "read `backend/CLAUDE.md` / `frontend/CLAUDE.md` before working in that
    side" (they load lazily on first file read there).
- **`backend/CLAUDE.md`, `frontend/CLAUDE.md`**: verbatim. All paths inside
  are relative to their own dir.
- **Skills**: stay in `backend/.claude/skills/` and `frontend/.claude/skills/`.
  Docs confirm subdirectory skills are discovered from the root and listed
  as `backend:pre-commit-review`, `frontend:review`, etc. **One fix
  [revised]**: both review skills currently declare frontmatter
  `name: pre-mr-review` with near-identical trigger phrases. Rename the
  frontend one's frontmatter `name` to `review` (matching its folder) so the
  two are distinguishable.
- **Commands and agents**: docs confirm subdirectory `.claude/commands/` and
  `.claude/agents/` are *not* discovered from the root, so they move to root
  `.claude/`. No filename collisions (checked).
- **Settings [revised]**: subdirectory `.claude/settings.json` files are
  *not* loaded when launched from the root, so the two repos' deny rules are
  lifted into root `.claude/settings.json` and the subdirectory files are
  deleted. Bare filenames match at any depth (gitignore semantics), so no
  `backend/` prefix is needed:
  ```json
  {
    "permissions": {
      "deny": [
        "Read(~/.ssh/**)", "Edit(~/.ssh/**)",
        "Read(.env)", "Edit(.env)",
        "Read(.env.local)", "Edit(.env.local)",
        "Read(.env.gnosis.prod)", "Edit(.env.gnosis.prod)"
      ]
    }
  }
  ```
  (`.env.local` and `.env.gnosis.prod` are new; the frontend never denied its
  env file before.)
- **Hooks**: none carried over.
- **Process/memory artifacts** (`backend/.claude/prds/`, frontend's
  `docs/project_notes/*`, `.claude/project.md`, `.claude/requirements.md`)
  stay where they are.
- **Auto-memory [revised]**: Claude's per-project memory lives in
  `~/.claude/projects/<slug>/memory/` and the slug is derived from the repo
  path, so the new repo starts with empty memory. After the first Claude
  launch in `gnosis_application` (which creates the new slug dir), copy the
  memory files from both old slugs
  (`-Users-pavlos-projects-gnosis-esoterica-api`,
  `-Users-pavlos-projects-tarot-divinations`) into it and merge the two
  `MEMORY.md` indexes. Delete `frontend-session-only.md` (it forbids editing
  the API repo from a frontend session — wrong in a monorepo). Review the
  rest for wording that assumes two repos.

## Git history (filter-repo) **[revised]**

Runs entirely on throwaway clones. `git-filter-repo` is not installed; it
runs via `uvx` (verified). Order matters: root scaffolding is committed first
so the imports merge into an existing branch.

```bash
WORK=$(mktemp -d)

# 1. rewrite a clone of each repo so every commit lives under its prefix
git clone /Users/pavlos/projects/gnosis-esoterica-api "$WORK/be"
git -C "$WORK/be" checkout main
(cd "$WORK/be" && uvx git-filter-repo --to-subdirectory-filter backend --force)

git clone /Users/pavlos/projects/tarot-divinations "$WORK/fe"
git -C "$WORK/fe" checkout main
(cd "$WORK/fe" && uvx git-filter-repo --to-subdirectory-filter frontend --force)

# 2. new repo: root files first
cd /Users/pavlos/projects/gnosis_application
git init -b main
# add root CLAUDE.md, Makefile, .gitignore, .claude/settings.json, docs/README.md
git add -A && git commit -m "chore: monorepo root scaffolding"

# 3. import both histories
git fetch "$WORK/be" main
git merge --allow-unrelated-histories -m "Import gnosis-esoterica-api history under backend/" FETCH_HEAD
git fetch "$WORK/fe" main
git merge --allow-unrelated-histories -m "Import tarot-divinations history under frontend/" FETCH_HEAD

# 4. cleanup commit: move commands/agents to root .claude/, delete
#    backend/.claude/settings.json, frontend/.claude/{settings.json,hooks/},
#    frontend/AGENTS.md, move backend/.github/workflows/ci.yml to root (edited),
#    rename frontend review skill frontmatter, fix stale doc paths.

rm -rf "$WORK"
```

`--force` is needed because filter-repo refuses to run on a clone that still
has an `origin` remote; it removes the remote as part of the rewrite. The
original repos are never touched.

## CI **[revised]**

GitHub only reads `.github/workflows/` at the repo root, so the backend
workflow at `backend/.github/workflows/ci.yml` would silently never run. Move
it to root, scoped to the backend:

```yaml
name: CI
on:
  push:
    branches: [main]
    paths: ["backend/**", ".github/workflows/ci.yml"]
  pull_request:
    paths: ["backend/**", ".github/workflows/ci.yml"]

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    env:
      JWT_SECRET_KEY: ci-only-secret   # Settings needs it at import time
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
        with:
          enable-cache: true
      - run: uv sync
      - run: make lint
      - run: make prompt-doc-check
      - run: make test
```

The frontend has no CI today; none is added by this work.

## Local-only state (not in git, copy by hand) **[revised]**

- `gnosis-esoterica-api/.env` → `backend/.env`
- `tarot-divinations/.env.local` → `frontend/.env.local`
- Optional: `gnosis-esoterica-api/.claude/RESUME.md` and `.superpowers/`
  (untracked session notes).
- Auto-memory dirs — see the Claude config section.
- Not copied: `.venv/`, `node_modules/`, `.next/`, `.pytest_cache/`,
  `.ruff_cache/`, `tsconfig.tsbuildinfo`, `CODE_INDEX.md`, `screenshots/`.
  `make install` recreates the first two.

## Docs fixes in the cleanup commit **[revised]**

- `backend/docs/database/production_mongo_commands.md`: the `pimongo` shell
  alias hardcodes `~/projects/gnosis-esoterica-api/scripts/pi-mongo.sh`;
  update to the new path (and the user's own shell alias).
- `frontend/docs/profile-dashboard.md` mentions both repos by their old
  paths; update the wording.
- New root `docs/README.md` indexes `backend/docs/` and `frontend/docs/`.

## Verification

1. `make install` succeeds from the root (installs both).
2. `make dev` starts both servers, logs interleave with `[backend]` /
   `[frontend]` prefixes, and one Ctrl+C stops both — check
   `ps aux | grep -E 'uvicorn|next dev'` shows nothing left.
3. `make test` runs backend pytest and frontend vitest, both matching their
   current standalone pass/fail state.
4. `make lint` runs both linters, matching current state.
5. **[revised]** Open Claude Code at the root. Ask it to read a file under
   `backend/` and confirm `backend/CLAUDE.md` content and the
   `backend:pre-commit-review` / `backend:execute` skills appear in its
   context; repeat for `frontend/` (`frontend:review`, `frontend:tarot`).
   Confirm the two agents and six commands are listed from the root.
   Confirm `Read backend/.env` is denied.
6. `git log --oneline -- backend/ | wc -l` equals the original repo's
   `git rev-list --count main` (86 at time of writing); same for `frontend/`
   (85). `git log -- backend/src/main.py` shows its full pre-merge history
   without `--follow`.
7. `make deploy` — read the script output only, do not actually push during
   verification — calls both original scripts in order with unchanged image
   names.
8. Push to GitHub and confirm the CI workflow runs on a backend change and is
   skipped on a frontend-only change.

## Follow-ups (out of scope for the merge)

- Refine the Claude workflow described in `frontend/CONTEXT_ENGINEERING.md`:
  code index generation, ctags, new tags, and whether any hooks should be
  re-introduced at the root.
- Decide when/whether to archive the two original GitHub repos. Until then
  they remain the fallback and are read-only by convention.
- Frontend CI.
- `make typecheck` in CI (blocked on pre-existing pyright errors).

## Open items

- GitHub: create a fresh `gnosis_application` repo (private) and set it as
  `origin`; not reusing either existing repo slot.
