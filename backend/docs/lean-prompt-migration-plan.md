# Lean Prompt Migration Plan

> **Status: Implemented through Phase 4** (2026-09-03); Phase 5 (frontend) pending.

TDD implementation plan for the lean prompt architecture. The **spec** is
[`docs/prompts/lean_prompt_architecture.md`](prompts/lean_prompt_architecture.md) —
all design decisions live there; this file is the working plan and base reference for
iterations. Experiment harness: `scripts/lean_prompt_test.py`; sample outputs in
`docs/prompts/experiments/`.

## Decisions locked (see spec §7)

- No card data sent — model's own Rider–Waite knowledge + numerology/astrology
- One woven narrative (`reading: str`), every card named explicitly; no per-card
  sections, no synthesis field
- Model `gpt-5.4`; intent kept (predictive/reflective); lens dropped (open: §8)
  - *Amended 2026-09-02 (twice)*: intent was briefly made optional and client-decided
    (`docs/make-intent-optional-and-client-decided.md`, now superseded), then
    **removed entirely** the same day — no settings in the API, prompt, or storage.
    The two-step preview→save flow collapsed into one idempotent
    `POST /readings/{id}/interpretation` that persists immediately; one
    interpretation per reading (unique `reading_id` index, migration 008). See spec §7.
- Server-owned word budget: `llm_words_per_card` (100) × cards; ×1.5 for
  significators (distinct cards); client `depth` removed
- Reversed guidance in every situational spread (*amended: the shipped Significators
  template has **no** reversal block — see spec §7's amended bullet*)
- Spread variants keyed off `spread_name`: `Significators`, `Tree of Life`
  (*amended 2026-09-02*: zone/position meanings come from the frontend per card;
  only the Tree's three-pillar structure stays baked into the system prompt.
  *Added 2026-09-08*: a third variant, `Relationship Reading` — spec §2)
- $3 budget cap: exact actuals charged in the inbound call; ledger on the
  interpretation doc + atomic reserve-then-settle gate on the user aggregate →
  HTTP 402; failed calls release the reservation — the user is never charged for
  a reading they didn't receive (wasted provider spend logged, absorbed)
- All tunables in `Settings` (`src/core/config.py`), prompt text in code

## Implemented 2026-09-02 (phases 0–4 ✅)

Everything below through Phase 4 is done. One decision the plan had left implicit was
made during implementation: with `lens` dropped, the saved-interpretation **slot is
keyed by `settings.intent`** — `PUT /readings/{id}/interpretations/{intent}`, unique
index `(reading_id, settings.intent)`, `IntentMismatchError` replacing
`LensMismatchError`. Migration 008 collapses legacy per-card docs into one narrative
(per-card texts + synthesis joined as paragraphs), collapses settings to `{intent}`,
dedupes collapsed lens slots keeping the newest per intent, and re-keys the index;
migration 009 drops the retired `total_tokens_used` counter. Phase 5 (frontend) and
the jwt_secret_key production prerequisite remain open.

Later the same day the intent decision was amended twice (see the note under
"Decisions locked"): first intent became optional, then it was removed entirely and
the generate/save pair collapsed into one idempotent
`POST /readings/{id}/interpretation` — migration 008 dedupes to one interpretation
per reading and re-keys the unique index to `reading_id` alone.

## Phase 0 — trim legacy tests ✅

- [x] `tests/llm/test_prompt_builder.py`: 64 → 20 essentials; first red TDD marker
      (`test_significators_carries_reversed_guidance`, strict xfail)
- [x] `tests/llm/test_adapter.py` (12): drop card-catalog-lookup and old-response-shape
      tests; keep error mapping, cap clamping, usage extraction
- [x] `tests/interpretations/*` (37): rewritten in Phase 3 around the lean shape

## Phase 1 — lean prompt builder (pure functions) ✅

Tests: `tests/llm/test_lean_prompt.py` against spec §2–§3.

- Config: `llm_words_per_card=100`, `significator_budget_scale=1.5` in `Settings`
- `total_word_budget(card_count, spread_name)` — linear, distinct-count + scale for
  significators
- `build_system_prompt(request)` — standard template (identity, question analysis with
  open-question freedom, INTENT, orientation, position fallback, narrative weave,
  ceiling phrasing) + spread variants (significators portrait; Tree of Life zones)
- `build_user_prompt(request)` — question line, spread header, one line per card
- Completion cap re-pointed at the lean budget
- Promote the strict-xfail reversed-guidance test to a real pass

## Phase 2 — schemas + adapter ✅

- `LeanReading { reading: str }` replaces `LLMInterpretationResult`;
  `InterpretationResponse` → `reading`, `model`, usage split (prompt/completion/
  reasoning tokens)
- `InterpretationSettings` → `intent` only (drop `depth`; `lens` per §8 decision)
- `OpenAIAdapter`: no catalog lookup / `CardNotFoundError`; same error mapping;
  usage split captured
- Mock adapter updated to the new shape
- Default `openai_model` → `gpt-5.4`
- Production controls folded in from `docs/prompts/scalable-openai.md` (now
  superseded):
  - `asyncio.Semaphore` capping in-flight calls (`openai_max_concurrent=10`), with a
    bounded acquire wait → 503 rather than unbounded queueing; per-process, so the
    effective cap multiplies by uvicorn workers
  - Explicit per-call timeout (`openai_timeout_seconds=120.0`) → new `LLMTimeoutError`
    (504); `except APITimeoutError` **before** `APIConnectionError` — it subclasses it,
    so the wrong order silently maps timeouts to 502
  - Explicit `max_retries` (`openai_max_retries=2`) on the `AsyncOpenAI` client;
    worst-case wall time ≈ timeout × (retries + 1) while holding a semaphore slot
  - Structured duration + outcome logging on success and on every failure path
    (implemented — `duration_s` on both the success INFO and failure WARNING lines)

## Phase 3 — usage accounting + budget gate (spec §5a) ✅

- Config: `user_budget_usd=3.00`, model price table ($/1M in/out)
- Pricing function from usage split × table (unit tests); resolved response model ids
  (`gpt-5.4-2026-…`) matched against table keys by prefix; unknown id → priced at the
  most expensive table entry with a warning — a price-table gap never fails a reading
- Ledger `usage` sub-doc on the interpretation document
- User aggregate `usage` + optional `budget_usd` override
- Atomic reserve-then-settle gate (spec §5a) in the interpretation command handler:
  reserve worst-case cost via filtered `find_one_and_update` (no match →
  `BudgetExceededError`, AppError → 402), settle to actuals after the call, release on
  any failure — failed readings never charge the user; wasted provider spend logged
- Retire the legacy `tokens_used` counter (`increment_tokens_used` on the user) —
  superseded by the `usage` aggregate; migrate or drop the field
- Mock adapter reports zero-cost usage so gate/ledger paths need no special-casing
- Response carries usage + remaining budget
- Migration: retire the legacy counter (idempotent, `NNN_` prefix) — as shipped,
  migration 009 only `$unset`s `total_tokens_used`; the `usage`/`budget_usd` fields
  are created lazily by the gate itself, not by a migration
- Router test: 402 shape; handler tests: reserve/settle/release + persistence +
  concurrent requests can't stack overshoot

## Phase 4 — cleanup ✅

- Delete `prompt_components.py`, old `prompt_builder.py` paths, dead tests
- Card catalog out of the interpret path (*as landed, there is no `/cards` route at
  all — `src/lib/cards/*.json` feeds only the offline `scripts/card_meanings.py`*)
- Regenerate/replace `docs/prompts/prompt_reference.md` generated regions
  (`make prompt-doc`) around the lean builder; retire superseded prompt docs
- Decide `birth_date` / `observer` (spec §5) — *resolved 2026-09-10: both removed
  from the LLM path; `birth_date` lives on in the readings domain only*

## Phase 5 — frontend coordination (spec §6)

- Single-narrative reading page; card-name anchors optional
- Remove depth slider + word-estimate mirror; lens picker per §8
- Budget-exhausted (402) state; show usage/remaining

## Production prerequisites (outside the prompt work)

- `jwt_secret_key` must lose its hardcoded default in `src/core/config.py` — require
  it from the environment and fail fast outside dev *(done 2026-09-10: the field has
  no default; startup fails without `JWT_SECRET_KEY`)*

## Open (spec §8)

- Lens: dropped or back as a one-line register
