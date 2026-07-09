# Decoupling Readings from Interpretations

## Current state

A reading and its interpretation are one document today. `CreateReadingHandler.handle()`
(`src/readings/commands/create_reading.py:32-86`) calls the LLM synchronously (line 39) and
saves a single `readings` document containing both the raw reading (spread, cards, question,
birth_date, tags) and the LLM output (`card_interpretations`, `synthesis`, `tokens_used`,
`model`). `Reading.from_document()` (`src/readings/models.py:57-72`) currently requires the
interpretation fields to be present — a reading cannot exist without one.

`src/llm/` is already a separate port/adapter (`LLMPort`, `OpenAIAdapter`, `MockLLMAdapter`)
with no knowledge of `readings`. The prompt is built in `src/llm/prompt_builder.py` from card
data in `src/lib/cards/*.json` (keywords, astrology, kabbalah, alchemy, numerology, archetype).

## Goals

- Let a user save a reading without generating an interpretation immediately.
- Let a user preview ("generate") an interpretation without persisting it, then explicitly
  save it.
- Let a user regenerate with different `context` and interpretation settings (style/depth/
  tone — see `docs/interpretation_calibratino.md`), without losing the previously saved
  interpretation until they choose to overwrite it.
- Support per-user default interpretation settings.

## Non-goals

- Interpretation history — only the latest saved interpretation is kept per reading (explicit
  simplicity decision, avoids new frontend list views).
- Credit deduction/enforcement — doesn't exist anywhere in the codebase today (confirmed via
  `grep -ri credit src`; `credits` is a stored, never-decremented field). Out of scope here.
  This feature makes repeated LLM calls easier to trigger before anything is ever saved, which
  makes that gap more visible — flagged as a follow-up, not designed here.
- Restructuring `src/lib/cards/*.json` keyword data — the literal/psychological/symbolic/
  esoteric weighting described in `docs/interpretation_calibratino.md` is achieved by
  instructing the model how to weight the *existing* fields, not by re-tagging the JSON.

## Data model

### `readings` (trimmed)

Drops `card_interpretations`, `synthesis`, `tokens_used`, `model`. Keeps spread, cards,
question, birth_date, tags. `Reading.from_document()` no longer requires interpretation keys.

### `interpretations` (new collection, new domain `src/interpretations/`)

One domain per collection, mirroring the existing convention (e.g. `src/readings/` owns
`readings`). Fields: `reading_id` (FK, one interpretation per reading), `user_id`,
`card_interpretations`, `synthesis`, `tokens_used`, `model`,
`settings: {style: str, depth: int, tone: int}` (nested — see below), `context` (optional,
≤100 chars), `created_at`, `updated_at`.

`reading_id` is stored as an `ObjectId` **everywhere** — application writes and the `006`
backfill alike (matching how `readings.user_id` is stored, `src/readings/models.py:38`). A
type mismatch (`ObjectId` vs string) would let two documents for the same reading slip past
the unique index.

`settings` is a nested sub-object, not three flat fields, matching the frontend's own wire
shape documented in `docs/interpretation_calibratino.md` (`{"style": "reflective", "depth":
65, "tone": 50}`) — this keeps request → domain model → document → read model a 1:1 shape
with no extra translation, and groups the three "how to interpret" controls apart from
`card_interpretations`/`synthesis`/`tokens_used`/`model` on the same document. Not a separate
collection — style/depth/tone are always accessed together with one specific interpretation
(or one user's defaults), never queried or listed independently, so a separate collection
would only add a repository/FK/join for no benefit (same reasoning as why `Reading.cards` is
an embedded list, not its own collection).

- `style`: one of `practical` / `reflective` / `spiritual` / `esoteric` (see
  `docs/interpretation_calibratino.md` for the full description and each preset's internal
  literal/psychological/symbolic/esoteric weight mapping).
- `depth`: `int`, `0-100`, mapped to word-count/detail bands (brief/standard/detailed/
  comprehensive).
- `tone`: `int`, `0-100`, mapped to language-register bands (0-33 gentle / 34-66 balanced /
  67-100 direct).

`context` (free-text, ≤100 chars) is unchanged and orthogonal to `settings` — it's situational
information about the querent (e.g. "recently divorced"), not a control over interpretation
style, so it stays a separate field rather than folding into `settings`.

Saving is an **upsert keyed by `reading_id`** — a new save replaces whatever was previously
saved for that reading. No history is kept. `created_at` goes in `$setOnInsert`, everything
else in `$set`, so `created_at` survives overwrites while `updated_at` refreshes.

### `users` (`src/auth/models.py:7-65`) — two new fields

- `interpretation_settings: {style: str, depth: int, tone: int}` (defaults: `style=reflective`,
  `depth=60`, `tone=50`, per `docs/interpretation_calibratino.md`'s Default Configuration
  table) — the user's stored global defaults, used whenever a generate call doesn't specify
  an override. Same nested shape as `Interpretation.settings` for the same reasons.
- `total_tokens_used: int` (default 0) — cumulative token count across **every** generate
  call (saved or not). Incremented each time `GenerateInterpretationHandler` gets a response
  back from the LLM, regardless of whether the result is ever saved. This exists so a future
  credit-deduction feature has real usage data to work from — no deduction logic is added now,
  just the counter. The increment is an atomic `$inc` (never read-modify-write) so concurrent
  generate calls don't lose updates. This makes `GenerateInterpretationHandler` the first
  handler to touch two domains' collections — it gets a user write repo injected alongside
  its other dependencies via the normal `main.py` mediator wiring.

Both fields need `to_document`/`from_document` support. Only `interpretation_settings` is
exposed, and only on `UserResponse` (`src/auth/schemas.py:32-39` — what `/auth/me` returns);
it's user-facing (the settings UI needs to read it back). The admin schemas
(`AdminUserResponse` in `src/auth/schemas.py` and `src/users/schemas.py`) don't serve the
settings UI and stay unchanged. `total_tokens_used` stays internal-only, consistent with
being invisible to the frontend; it's never added to any read schema.

## API surface

The two new `POST .../interpretation*` endpoints live in the new domain's own
`src/interpretations/router.py`, mounted with the same `/readings` prefix (new domain, new
router — `src/readings/router.py` is not touched by them). `GET /readings/{reading_id}` and
the list stay in the readings router.

- `POST /readings` — creates the reading only. No LLM call — `CreateReadingHandler` drops its
  `llm: LLMPort` constructor dependency entirely. Returns `ReadingReadModel` with
  `interpretation: None`.
- `POST /readings/{reading_id}/interpretation/generate` — body: optional `context` (≤100
  chars), optional `settings` (`{style, depth, tone}`, each individually optional — any field
  omitted falls back to the user's stored `interpretation_settings` for that field).
  `GenerateInterpretationHandler` first fetches the `Reading` (via `ReadingReadRepository`,
  with the same ownership check) to get `cards`, `spread_name`, `question`, `birth_date` — the
  request body alone doesn't carry these. It then calls the LLM via the existing `src/llm/`
  port, increments `user.total_tokens_used` by the response's `tokens_used`, and returns the
  interpretation content directly, **including the resolved `settings`** (the concrete
  style/depth/tone actually used — request values, or the user's stored defaults per-field
  when omitted). Without echoing this back, the frontend can't know what was used when any
  field was defaulted server-side, and can't pre-fill or guard a subsequent regenerate.
  **Nothing is persisted to `interpretations`.**
- `POST /readings/{reading_id}/interpretation` (save) — body: the interpretation content
  (echoed back from generate) + `settings` + `context`. `SaveInterpretationHandler` never
  calls the LLM and never touches `total_tokens_used` — it only persists what it's given.
  Upserts into `interpretations` by `reading_id`. Returns the saved `InterpretationReadModel`.
  The stored `tokens_used`/`model` are therefore client-supplied and **untrusted** —
  display-only. Anything billing-relevant lives in `user.total_tokens_used`, counted
  server-side at generate time, so fabricating them gains nothing.
- `GET /readings/{reading_id}` — returns the reading plus its saved interpretation embedded
  inline (`interpretation: InterpretationReadModel | None`). `GetReadingByIdQuery` gains a
  lookup against the new `interpretations` collection (`find_by_reading_id`).
- `GET /readings` (list) — `ReadingListItem` gains a `has_interpretation: bool` so the
  frontend can badge readings that still need one without fetching each individually.
- `PATCH /auth/me` — new endpoint (none exists today; `UpdateReadingTagsCommand` at
  `src/readings/commands/update_reading_tags.py:10-35` is the CQRS template to follow). Body:
  `interpretation_settings` (`{style, depth, tone}`). Updates the stored default only — a
  per-call override on generate never changes this. Returns the updated `UserResponse`
  (including `interpretation_settings`) so the settings UI needs no follow-up GET.
- `PATCH /readings/{reading_id}/tags` — unchanged endpoint, but note: it does **not** look up
  the interpretation (only `GetReadingByIdQuery` does), so its `ReadingReadModel` response
  always carries `interpretation: null` even when one is saved. The frontend must treat this
  response as tags-only and never re-render interpretation state from it.

All new endpoints require the same ownership check `GetReadingByIdQuery` already does (reading
must belong to the requesting user) — `ReadingNotFoundError` on mismatch/missing.

## Prompt / calibration mechanism

Full semantics (preset descriptions, weight mappings, depth/tone bands, example phrasing) live
in `docs/interpretation_calibratino.md` — this section covers only how it plugs into the
existing `src/llm/` code.

`InterpretationRequest` (`src/llm/schemas.py:28-34`) gains `settings: InterpretationSettings`
(`{style: ReadingStyle, depth: int, tone: int}`) and `context: str | None` (`max_length=100`).
`GenerateInterpretationHandler` always resolves concrete `settings` before building this
object (per-field: request value, or the user's stored `interpretation_settings` value when
omitted) — never partially-optional by the time it reaches `src/llm/`.

`src/llm/prompt_builder.py` needs four lookup tables instead of the previous single 6-entry
one:
- `style` → a 4-axis weight dict (`literal`/`psychological`/`symbolic`/`esoteric`), one entry
  per `ReadingStyle` value, plus the shared instruction to prioritize higher-weighted layers
  and avoid enumerating every correspondence just because it exists (the "Prompt Rules"
  section of `docs/interpretation_calibratino.md`).
- `depth` (banded 0-25/26-50/51-75/76-100) → target word count + level of symbolic/synthesis
  detail.
- `tone` (banded 0-33/34-66/67-100 → gentle/balanced/direct) → language-register guidance
  with example phrasing.

`build_system_prompt` (currently `spread_name`-only, `L99-102`) takes the request and appends
the style-weight instructions to `_SYSTEM_PROMPT`/`_SIGNIFICATORS_SYSTEM_PROMPT`. This changes
how the model is told to weight the existing per-card data (keywords vs.
astrology/kabbalah/alchemy/archetype) — the card JSON itself is unchanged.
`build_user_prompt` (`L116-149`) appends the depth/tone guidance and, when `context` is set, a
line near the existing `Question:` line (`L121-122`): `Additional context from the querent:
{context}`.

### Avoiding wasteful duplicate LLM calls

`generate` is stateless by design, so the backend has no memory of a previous generate call
that was never saved — the only persisted reference point is the currently *saved*
interpretation for that reading, if any. A backend-side "reject if unchanged" check would only
catch "unchanged since last save" (blind to repeated unsaved attempts) and would also block a
deliberate reroll with identical settings, which is legitimate given the LLM isn't
deterministic. Decision: **frontend-only guard** — disable/grey the regenerate action until
`settings` or `context` actually differ from what's currently displayed. No backend
enforcement.

## Migration

Dev-only data today (fewer than 5 readings), so low risk, but still in scope. Two migrations,
following the `NNN_snake_case.py` / `version` / `description` / `up(db)` convention in
`docs/db_migrations.md` (template: `src/migrations/versions/004_reading_birthdate_index.py`):

- `005_interpretations_indexes.py` — adds `INTERPRETATIONS_COLLECTION = "interpretations"` to
  `src/database/collections/constants.py:4`, then creates a **unique index on `reading_id`**
  (Mongo creates the collection implicitly on first index). The uniqueness constraint enforces
  "one interpretation per reading" at the DB level, backstopping the application-level upsert.
- `006_backfill_interpretations.py` — for each existing reading with `card_interpretations`,
  upserts (`$setOnInsert`, keyed by `reading_id` as an **`ObjectId`**, same as the application
  writes it) a corresponding `interpretations` document
  with the embedded data, defaulting `settings` to `{style: "reflective", depth: 60, tone: 50}`
  and `context` to `None` since pre-settings readings never had these. Idempotent per the
  `$exists`/upsert backfill pattern already documented (`docs/db_migrations.md:115-125`).

Leftover embedded fields on old `readings` documents are harmless (ignored by the trimmed
`Reading.from_document()`, not actively stripped).

No migration is needed for the two new `User` fields (`interpretation_settings`,
`total_tokens_used`) — following this codebase's "optional fields omitted from documents"
convention, `User.from_document()` defaults them via
`.get("interpretation_settings", {"style": "reflective", "depth": 60, "tone": 50})` /
`.get("total_tokens_used", 0)` instead of backfilling every existing user document.

## Breaking change

`ReadingReadModel` currently returns `card_interpretations`/`synthesis` as flat fields; this
becomes a nested `interpretation` object (or `null`). This intentionally breaks the current
API response shape — frontend must adapt.

## Validation

- `style`: `ReadingStyle` (`StrEnum`: `practical`, `reflective`, `spiritual`, `esoteric` —
  mirrors the `Orientation(StrEnum)` pattern in `src/llm/schemas.py:9-11`).
- `depth`: `int`, `ge=0, le=100`.
- `tone`: `int`, `ge=0, le=100`.
- `context`: `str | None`, `max_length=100`.

## Naming (CQRS)

- `src/interpretations/commands/generate_interpretation.py` — `GenerateInterpretationCommand`
  / `GenerateInterpretationHandler` (calls LLM + increments token counter; does not persist).
- `src/interpretations/commands/save_interpretation.py` — `SaveInterpretationCommand` /
  `SaveInterpretationHandler` (upsert).
- `src/auth/commands/update_interpretation_settings.py` —
  `UpdateInterpretationSettingsCommand` / `UpdateInterpretationSettingsHandler`.
- `src/interpretations/repository.py` — `InterpretationWriteRepository` /
  `InterpretationReadRepository`, collection constant in
  `src/database/collections/constants.py`.
- `src/interpretations/router.py` — owns the two `POST /readings/{reading_id}/interpretation*`
  endpoints (mounted with the `/readings` prefix).

## Follow-ups (explicitly out of scope)

- Credit deduction/enforcement using `total_tokens_used`.
- Rate-limiting repeated generate calls.

## Build order

Three steps, each a shippable and independently testable slice. Each step changes real
frontend-visible behavior (or response shape), so the frontend can be built and verified before
moving to the next step — no throwaway work, no step depends on anything later than itself.

### Step 1 — Decouple readings from interpretations (no settings yet)

Ship the real target architecture directly — no transitional fused state. Interpretation
settings are left out of this step; `generate` just re-runs the existing (untuned) prompt,
relocated from `CreateReadingHandler` to its own handler.

- New `src/interpretations/` domain: `router.py` (the two `POST .../interpretation*`
  endpoints, `/readings` prefix), `models.py`, `repository.py`
  (`InterpretationWriteRepository`/`InterpretationReadRepository`), `schemas.py`
  (`InterpretationReadModel`).
- Migrations `005_interpretations_indexes.py` and `006_backfill_interpretations.py`.
- `POST /readings` drops its LLM call and `LLMPort` dependency entirely — persists the trimmed
  reading only.
- New `POST /readings/{reading_id}/interpretation/generate` (stateless; fetches the `Reading`
  for LLM context; no `settings`/`context` params yet — the response echoes a hardcoded
  `DEFAULT_SETTINGS` (`{style: "reflective", depth: 60, tone: 50}`), which save then persists,
  so the schema and response shape don't change again in Step 2).
- New `POST /readings/{reading_id}/interpretation` (save/upsert).
- `total_tokens_used` field on `User` (`src/auth/models.py`), incremented by
  `GenerateInterpretationHandler` after each LLM call — moved here (not Step 3) since that's
  the handler that actually calls the LLM.
- `GetReadingByIdQuery` reads the interpretation from the new collection.
- **Frontend**: build the real flow — save reading → generate → confirm → save interpretation;
  regenerate just re-runs generate (no tuning controls yet).
- **Test**: full flow end-to-end — save without generating, generate, save, regenerate,
  overwrite a previously saved interpretation.

### Step 2 — Add interpretation settings (style/depth/tone) and context

Layer the tuning feature onto the now-decoupled `generate` endpoint. See
`docs/interpretation_calibratino.md` for the full style/depth/tone semantics.

- `InterpretationRequest` (`src/llm/schemas.py`) gains `settings`/`context`; the four lookup
  tables (style→weights, depth bands, tone bands, plus the shared "prioritize higher-weighted
  layers" instruction) added to `prompt_builder.py`.
- `generate` request body accepts optional `settings` (`{style, depth, tone}`, each
  individually optional) and `context`.
- **Frontend**: add the style/depth/tone controls + context field to the regenerate UI;
  disable regenerate until something actually changed (frontend-only guard, per earlier
  decision).
- **Test**: regenerate the same reading across a representative sample of style/depth/tone
  combinations (not exhaustive — spot-check that each axis visibly shifts the output and that
  combinations stay coherent, e.g. `esoteric` + `brief` + `direct` shouldn't read like a
  broken template).

### Step 3 — Per-user default settings, list badge

Purely additive polish — no risk to the core flow, safe to defer to last.

- `interpretation_settings` field on `User` (defaulted via `.get()`, no migration needed —
  `total_tokens_used` was already added in Step 1).
- `PATCH /auth/me` (`UpdateInterpretationSettingsCommand`/`Handler`).
- `generate` defaults each omitted `settings` field to `user.interpretation_settings`.
- `has_interpretation` on `ReadingListItem`.
- **Frontend**: settings UI for the defaults; list view badge.
- **Test**: generate without explicit settings uses the stored defaults; updating the defaults
  changes future generations but not past saved interpretations; list view badges correctly.
