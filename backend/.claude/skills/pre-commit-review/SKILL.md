---
name: pre-mr-review
description: >
  Pre-MR self-review for FastAPI/Python backend code. Trigger on: "pre-flight check",
  "ready to open MR", "about to create a PR", "check my changes before I push",
  "self review", "pre-mr check", "is this ready to merge", "review before I open the PR",
  "check my local changes", "pre-push review", "sanity check my diff", "anything I missed",
  "last check before PR". Runs git diff HEAD to gather all local changes, infers intent from
  branch name and commits, then runs pre-flight checks (debug/secrets/env/Docker) and a
  four-pillar adversarial review with FastAPI-specific checklists covering Pydantic models,
  async/Motor patterns, structured logging, and deployment concerns. Outputs a self-review
  checklist the developer resolves before opening the MR. Use this skill even if the user
  just says "review my changes" without a PR URL — the absence of a URL is a signal this is
  a local pre-push review, not a PR review.
---

# Pre-MR Self-Review — FastAPI / Python Backend

You are a strict senior reviewer acting as the developer's own conscience. Your job is to
catch everything a colleague would flag — before it reaches them. Be direct and specific.
This is a safe space to find problems; the goal is a clean MR, not a comfortable review.

This skill is scoped to **Python / FastAPI / Motor / MongoDB / Redis** backends. If the diff
contains frontend files (.tsx, .jsx), note them but do not review them — suggest the user
run the frontend pre-flight separately.

---

## Phase 1 — Gather Local Context

Run these commands in order. Do not ask the user to paste output.

```bash
# 1. All changes vs last commit (staged + unstaged)
git diff HEAD

# 2. Branch name — used to infer intent
git branch --show-current

# 3. Recent commits on this branch vs main (for intent context)
git log main..HEAD --oneline 2>/dev/null || git log origin/main..HEAD --oneline

# 4. List of changed files
git diff HEAD --name-only
```

If the working directory is clean (`git diff HEAD` returns nothing), tell the user
there are no local changes to review and stop.

---

## Phase 2 — Infer Intent

With no PR description yet, reconstruct intent from:

- **Branch name**: `feature/add-stripe-webhook` → adding Stripe webhook handling
- **Commit messages**: from `git log main..HEAD --oneline`
- **Changed file names**: from `git diff HEAD --name-only`

State the inferred intent at the top of the review:
> *"Based on branch `feature/jwt-refresh` and changed files, this appears to be: adding JWT
> refresh token logic to the auth flow."*

If intent is genuinely ambiguous, flag it — a vague branch name is itself a finding.

---

## Phase 3 — Pre-Flight Checks

Run these before the four pillars. A single 🔴 here means the MR is not ready.

### 🚨 Debug & Leftovers

Scan `+` lines in the diff for:

| Pattern | Flag as |
|---|---|
| `print(`, `pprint(`, `breakpoint()`, `import pdb`, `pdb.set_trace()` | 🔴 Remove before MR |
| `# TODO:`, `# FIXME:`, `# HACK:`, `# XXX:` in new lines | 🟡 Resolve or create a ticket |
| Commented-out code blocks (3+ consecutive commented lines) | 🟡 Delete or explain |
| `raise Exception(` (bare Exception, not a specific type) | 🟡 Use a specific exception class |

### 🚨 Secrets Scan

Scan `+` lines for patterns that look like leaked credentials:

| Pattern | Flag as |
|---|---|
| Strings matching `sk_`, `pk_`, `rk_`, `Bearer `, `AKIA`, `-----BEGIN` | 🔴 BLOCKING |
| Hardcoded passwords, tokens, or API keys (long random alphanumeric strings assigned to a variable) | 🔴 BLOCKING |
| `.env` file included in diff | 🔴 BLOCKING |

### 🚨 Environment & Config

Scan for operational consistency:

| Pattern | Flag as |
|---|---|
| New `os.environ["KEY"]` or `os.getenv("KEY")` without a matching entry in `.env.example` or docs | 🟡 Add to `.env.example` |
| New env var in code but no default / no `Settings` model update | 🟡 Add to config |
| `Dockerfile` or `fly.toml` changed without a comment in the commit explaining why | 🟡 Document the change |
| `Dockerfile` adds a new system dependency without pinning a version | 🟡 Pin the version |
| `requirements.txt` / `pyproject.toml` adds a package without version constraint | 🟡 Pin or constrain |

### 🧪 Test Coverage

For every new function, class, or route introduced in the diff, check:

- Is there a corresponding new or updated test in the diff?
- If no test exists: is the logic trivial enough to skip (a 2-line getter), or is it
  business logic that genuinely needs coverage?

Flag untested logic as:
- 🔴 **No test — should have one**: new route handlers, service functions, validators,
  business logic with branching, error handling paths
- 🟡 **No test — low risk**: simple mappers, type aliases, config constants

---

## Phase 4 — Four-Pillar Review

Review **new code only** (`+` lines). Do not flag unchanged surrounding code.

---

### Pillar 1 — Edge Cases & Risks

Ask: *What inputs, states, or timing conditions could break this new code?*

State each finding as: **trigger condition → failure mode → blast radius**.

**Async & Event Loop**
- Blocking IO in `async def`: `requests.*`, `time.sleep()`, synchronous DB calls → stalls
  entire event loop → all concurrent requests hang. Must use `httpx`, `asyncio.sleep`, `motor`.
- Missing `await` on Motor/async calls: `collection.find_one(...)` without `await` returns a
  coroutine object, not the result → silent wrong behaviour, no error raised.
- `BackgroundTasks` for critical side-effects: fire-and-forget with no retry → emails,
  billing events, audit logs must use a proper queue (ARQ, Celery).

**Pydantic Models**
- `Optional[T]` without `= None`: may be required depending on Pydantic version → validate
  intent matches actual behaviour. Check consistency across the model.
- Field validators referencing other fields: in Pydantic v2, `@field_validator` runs per-field
  before `@model_validator` → cross-field logic belongs in `@model_validator(mode='after')`.
- Serialization aliases (`alias=`, `by_alias=`): if a model uses aliases for MongoDB `_id` or
  API naming, ensure all serialization paths use `by_alias=True` consistently.
- Response model exposes sensitive fields: check that `password`, `hashed_password`, `token`,
  `secret`, `api_key`, or other sensitive fields are excluded from response models
  (`exclude=True`, separate response schema, or `model_config = ConfigDict(json_schema_extra=...)`).

**MongoDB / Motor**
- Unbounded `.find()` or `.aggregate()` without `.limit()` → full collection scan as data grows.
- Query on non-indexed field → full scan in production. Flag if unclear whether index exists.
- IDOR — missing `user_id` scoping: query missing owner filter → any authenticated user can
  read/modify any record.
- `ObjectId` in response without `str()` → JSON serialisation failure at runtime.
- Document shape change without migration plan: new required field on existing documents →
  `KeyError` or `None` at runtime for old docs.

**Redis**
- Check-then-set race: `GET` followed by `SET` is not atomic → use `SET NX EX` or Lua script.
- Key without TTL: `redis.set(key, value)` with no `ex=` → key persists forever.
- Key namespace collision: keys not following `namespace:id` pattern.

**Auth & Security**
- New route without considering auth: does this endpoint need auth? Not all do, but
  the decision should be conscious, not accidental.
- CORS origin list changed: removing an origin silently blocks all requests from that domain.

**Error Handling**
- `except Exception` swallowing errors: bare except that logs and returns 200 → failure is
  invisible to monitoring and the caller.
- No error handling on DB operations: Motor calls without try/except →
  unhandled `pymongo.errors` surface as 500s with stack traces.
- Missing `raise` after logging in except block → execution continues silently.

---

### Pillar 2 — Regression Impact

Ask: *What currently working code could this change break?*

Cross-reference deleted (`-`) lines and changed function signatures within the diff.

Severity:
- 🔴 Breaking — will fail in prod immediately
- 🟡 Degraded — silent behaviour change
- 🟢 Low risk — unlikely to affect existing paths

**Checklist:**
- Pydantic model field removed or renamed: stored MongoDB documents and serializing code
  silently drops or fails on the missing field.
- Route path or HTTP method changed: frontend callers, other services, integration tests
  hitting the old path get 404s.
- `Depends()` signature changed: every route using this shared dependency is affected —
  check callers not in this diff.
- MongoDB document shape changed: existing documents lack new required fields.
- Redis key namespace changed: existing sessions/cache under old pattern become orphaned.
- Auth0 audience or issuer changed: all currently-valid tokens fail validation.
- Test assertions weakened: `== 201` → `< 500` in `-` lines → intentional or regression?
- Shared utility function signature changed: callers outside this diff may break.
- Default parameter value changed on existing function: all callers relying on the old
  default get new behaviour silently.

---

### Pillar 3 — Code Smells

Ask: *Will I be embarrassed by this code in 3 months?*

Only flag smells **introduced in this diff**:

- **Fat route handler**: route does validation, business logic, DB queries, AND response
  shaping → extract to service layer.
- **Raw dict instead of Pydantic model**: `{"user_id": x}` passed between layers → loses
  validation, auto-docs, IDE support.
- **Deep nesting**: nested try/except inside nested if inside a loop → flatten with early
  returns or extracted helpers.
- **Duplicated DB access pattern**: same `collection.find_one({"_id": id})` in multiple
  new routes → extract to repository function.
- **Magic status codes**: `JSONResponse(status_code=403, ...)` → use
  `fastapi.status.HTTP_403_FORBIDDEN`.
- **PII in logs**: emails, names, tokens, user IDs in `logger.*` → GDPR issue.
- **Missing structured logging**: new `logger.info("thing happened")` without structured
  fields → should be `logger.info("thing happened", extra={"user_id": ..., "action": ...})`
  or equivalent. Grep for `f"` or `%` formatting in log calls.
- **Inconsistent logging levels**: business events at DEBUG, errors at INFO → align with
  project conventions.

---

### Pillar 4 — DRY & SOLID

Ask: *Am I introducing duplication or structural debt?*

**DRY**
- Same query or DB access pattern duplicated across new routes → extract to repository.
- Same validation logic across multiple Pydantic models → use model inheritance or shared
  validators.
- Same error response hand-constructed in multiple routes → raise `HTTPException` or use
  shared exception handler.
- Near-identical endpoints differing by one filter → parameterise.

**SOLID**
- **S**: route handler validates, queries, transforms, and responds → split into
  Route → Service → Repository.
- **O**: new behaviour added by copy-pasting a service function → extend via parameters
  or strategy, don't copy.
- **D**: service class instantiates its own MongoDB collection directly → inject a
  repository abstraction for testability.
- **I**: dependency injects a large shared object when only one method is needed → narrow
  the interface.

**MongoDB**
- Critical writes use `w="majority"` to avoid data loss on failover.
- Hot-path queries project only required fields — not fetching full documents when 2 fields
  suffice.

**Redis**
- Client has reconnection / keepalive logic (critical on Fly.io where idle connections die).
- New keys follow `namespace:id` pattern.

---

### Pillar 5 — Type Hints (Public API Only)

Check **route handlers and public service functions** (not internal helpers):

- Missing return type annotation on route → FastAPI can't generate accurate OpenAPI docs.
- Missing parameter type on route → implicit `Any`, loses validation.
- Response model (`response_model=`) does not match the actual return type → runtime
  serialisation mismatch or silent field dropping.
- `response_model` present but function returns a dict instead of the model instance →
  Pydantic does implicit conversion, but this hides shape bugs.

Do not flag private helper functions or internal utilities for missing type hints.

---

## Phase 5 — Deployment & Migration Check

If the diff touches any of these, flag deployment considerations:

| Change | Flag |
|---|---|
| New MongoDB field on existing collection | 🟡 Need backfill script or handle missing field gracefully |
| New env var | 🟡 Update deployment config (Fly.io secrets, `.env.example`) |
| New Python dependency | 🟡 Rebuild Docker image |
| `Dockerfile` changed | 🟡 Test build locally before push |
| `fly.toml` changed | 🟡 Review — wrong config = broken deploy |
| New background task or worker | 🟡 Does the process runner (Fly.io, Docker) know about it? |
| Database index needed | 🟡 Create index before deploying the code that queries it |
| Breaking API change | 🔴 Coordinate with frontend / consumers |

---

## Phase 6 — Output

Produce a self-review checklist. Group by priority — blockers first.

````markdown
## 🛫 Pre-MR Review — FastAPI Backend

**Inferred intent:** [one sentence from branch/commits/files]
**Overall readiness:** 🔴 NOT READY / 🟡 NEARLY THERE / 🟢 GOOD TO GO

---

### Fix Before Pushing (Blockers)
- [ ] [specific issue — file:line — what to fix]
- [ ] ...
_or: ✅ No blockers found._

---

### Fix Before Opening MR
- [ ] [edge case / regression / smell — file:line — what to fix]
- [ ] ...
_or: Nothing critical._

---

### Test Coverage Gaps
- [ ] `function_name()` in `file.py` — [why it needs a test] — suggested: [test scenario]
- [ ] ...
_or: New logic is covered._

---

### 🏗️ Deployment Checklist
- [ ] [env var / migration / Docker concern — what to do]
- [ ] ...
_or: No deployment concerns._

---

### Non-Blocking Suggestions
- [smell / SOLID / DRY / logging note — file:line — suggestion]
_or:  None._

---

### MR Description Starter

**Title:** [suggested title based on inferred intent]

**Description:**
> [2–3 sentences: what this changes, why, and any deployment or migration notes]

**Checklist before merge:**
- [ ] Tests pass
- [ ] [any specific item surfaced by this review]
````

---

## Tone & Stance

- **Assume the author is competent** — flag real issues, don't explain basics
- **Scope strictly** — only new `+` lines, not surrounding context code
- **Blockers are non-negotiable** — secrets and debug statements must go, full stop
- **Be specific** — file name, line number, exact fix. "Consider improving error handling"
  is not a finding.
- **The MR description starter is a gift** — a vague description leads to slow reviews;
  help the developer write a clear one from the start