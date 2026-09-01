# Lean Prompt Migration Plan

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
- Server-owned word budget: `llm_words_per_card` (100) × cards; ×1.5 for
  significators (distinct cards); client `depth` removed
- Reversed guidance in every spread, significators included
- Spread variants keyed off `spread_name`: `Significators`, `Tree of Life`
  (eleven zones baked into the system prompt)
- $3 budget cap: exact actuals charged in the inbound call; ledger on the
  interpretation doc + `$inc` aggregate on the user; threshold gate → HTTP 402
- All tunables in `Settings` (`src/core/config.py`), prompt text in code

## Phase 0 — trim legacy tests ✅ (in progress)

- [x] `tests/llm/test_prompt_builder.py`: 64 → 20 essentials; first red TDD marker
      (`test_significators_carries_reversed_guidance`, strict xfail)
- [ ] `tests/llm/test_adapter.py` (12): drop card-catalog-lookup and old-response-shape
      tests; keep error mapping, cap clamping, usage extraction
- [ ] `tests/interpretations/*` (37): flag tests pinning `card_interpretations[]` +
      `synthesis` for rewrite in Phase 3

## Phase 1 — lean prompt builder (pure functions)

Red first: `tests/llm/test_lean_prompt.py` against spec §2–§3.

- Config: `llm_words_per_card=100`, `significator_budget_scale=1.5` in `Settings`
- `total_word_budget(card_count, spread_name)` — linear, distinct-count + scale for
  significators
- `build_system_prompt(request)` — standard template (identity, question analysis with
  open-question freedom, INTENT, orientation, position fallback, narrative weave,
  ceiling phrasing) + spread variants (significators portrait; Tree of Life zones)
- `build_user_prompt(request)` — question line, spread header, one line per card
- Completion cap re-pointed at the lean budget
- Promote the strict-xfail reversed-guidance test to a real pass

## Phase 2 — schemas + adapter

- `LeanReading { reading: str }` replaces `LLMInterpretationResult`;
  `InterpretationResponse` → `reading`, `model`, usage split (prompt/completion/
  reasoning tokens)
- `InterpretationSettings` → `intent` only (drop `depth`; `lens` per §8 decision)
- `OpenAIAdapter`: no catalog lookup / `CardNotFoundError`; same error mapping;
  usage split captured
- Mock adapter updated to the new shape
- Default `openai_model` → `gpt-5.4`

## Phase 3 — usage accounting + budget gate (spec §5a)

- Config: `user_budget_usd=3.00`, model price table ($/1M in/out)
- Pricing function from usage split × table (unit tests)
- Ledger `usage` sub-doc on the interpretation document
- User aggregate `usage` + optional `budget_usd` override; atomic `$inc`
- `BudgetExceededError` (AppError → 402) gate in the interpretation command handler
- Response carries usage + remaining budget
- Migration: user usage/budget fields (idempotent, `NNN_` prefix)
- Router test: 402 shape; handler tests: gate + persistence

## Phase 4 — cleanup

- Delete `prompt_components.py`, old `prompt_builder.py` paths, dead tests
- Card catalog stays for `/cards`; remove interpret-path usage
- Regenerate/replace `docs/prompts/prompt_reference.md` generated regions
  (`make prompt-doc`) around the lean builder; retire superseded prompt docs
- Decide `birth_date` / `observer` (spec §5: decide or delete)

## Phase 5 — frontend coordination (spec §6)

- Single-narrative reading page; card-name anchors optional
- Remove depth slider + word-estimate mirror; lens picker per §8
- Budget-exhausted (402) state; show usage/remaining

## Open (spec §8)

- Lens: dropped or back as a one-line register
