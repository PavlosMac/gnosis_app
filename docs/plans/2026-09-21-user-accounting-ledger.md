# User accounting: admin-set model and prices, monthly period, superadmin ledger

**Status:** agreed design, not started (agreed 2026-09-21; split out of the reference doc 2026-10-10;
price source replaced by admin input and per-spread cost table added 2026-10-24).

What the ledger does today, every file involved and the known gaps are in
[`../reference/interpretations/user-accounting.md`](../reference/interpretations/user-accounting.md).
This plan is the agreed follow-up.

Principles: smart, minimal calls; errors small, bounded and self-healing; no scheduler; no new
outbound dependency; existing data is expendable, so shapes change without backfills. Anything
that changes when the model changes (the model id, its prices, what a spread costs) must be
changeable and visible from the superadmin UI, never by editing code or env.

## 1. Model and prices: admin input, not a feed

There is no OpenAI price API. The 2026-09-21 design pulled prices from LiteLLM's public price
list with guard rails against bad commits, a single-flight refresh and a stale-while-revalidate
cache. That was dropped on 2026-10-24: it was the most machinery in the plan, guarding a value
that changes a few times a year and that the owner can type in from OpenAI's pricing page.

Instead the superadmin sets, from the UI:

- the **model id** sent to OpenAI (today env `OPENAI_MODEL`, baked into `OpenAIAdapter` at
  startup in `main.py`);
- the **input and output price**, $ per 1M tokens, standard tier (today the hand-typed
  `model_price_table` in `src/core/config.py`).

Rules:

- Values live in one Mongo document (§2). `Settings.openai_model` and `model_price_table` stay as
  the **seed** when no document exists and as the dev default. `mock` stays the no-API-key mode and
  is never priced.
- **Validate the model id on save** with `client.models.retrieve(id)`. It is free and answers
  immediately, so a typo is refused at save time instead of failing every reading. Prices must
  be positive and below an absolute ceiling (proposed $1,000 per 1M). Nothing else; the owner is
  the guard rail.
- **Read once per generate request.** `GenerateInterpretationHandler` loads the document at the
  top of the request (one Mongo read next to the ones it already does) and passes the model to
  the adapter per call and the prices to `worst_case_cost_usd` and `cost_usd`. No memo, no TTL:
  an admin change applies to the next reading. `OpenAIAdapter.model` becomes a per-call argument
  with the settings value as default.
- `resolve_prices` keeps its dated-snapshot logic so the response's resolved id
  (`gpt-5.4-2026-03-05`) still maps to the configured model.
- **Every save is a structured log event** with the acting admin's `user_id` and the before and
  after values. No stored audit trail.
- `reasoning_effort` and `max_tokens` **stay in env.** They rarely change when the model does and
  they shape the completion cap, which is tested against the current values. Revisit if a model
  switch shows truncations (§5).

## 2. App-state collection

One small collection, documents keyed by `_id`, created lazily, seeded from `Settings`:

| `_id` | Fields | Replaces |
|---|---|---|
| `llm_settings` | `model`, `input_usd_per_m`, `output_usd_per_m`, `updated_at`, `updated_by` | env `OPENAI_MODEL`, `MODEL_PRICE_TABLE` |
| `budget_default` | `budget_usd`, `updated_at`, `updated_by` | env `USER_BUDGET_USD` |

No other documents. Per-spread cost profiles are **not** stored (see §5); they are derived.

## 3. Monthly budget period

- `users.usage` gains `period`, a UTC month key such as `2026-09`.
- **Lazy rollover inside the gate.** `reserve_usage` becomes one atomic pipeline update: treat
  spend as 0 when the stored period is not the current month, compare that to the budget, and on
  success write the current period, the reset-or-kept spend plus the reservation, and reset the
  period's token and reading counters when the period changed. No job resets anyone; a user rolls
  over on their first reading of the month.
- **Readers must apply the same rule.** `remaining_budget_usd` and the dashboard treat a stale
  period as nothing spent, otherwise the chalice shows last month's level until the next reading.
- History is the per-call ledger (`interpretations.usage`, grouped by month); the aggregate only
  describes the current period.
- Month-boundary race: a call reserved in one month and settled in the next, with a rollover in
  between, leaves spend off by at most one reservation, in the user's favour. Accepted.
- Side effect: a reservation leaked by a killed process now heals at the next period boundary.
- Implementation risk to check first: the tests run on `mongomock-motor`; confirm it supports a
  pipeline-style `find_one_and_update` with `$cond` before committing to this form. The fallback
  is two filtered updates (rollover, then reserve), which stays safe because both are idempotent.

## 4. Ledger stamp

Each `interpretations.usage` row gains four fields, written at persist time, never backfilled:

| Field | Why |
|---|---|
| `input_usd_per_m`, `output_usd_per_m` | The unit prices that produced `cost_usd`. Cost stays frozen at call time; any later over- or under-charge question is a query. |
| `spread_type`, `card_count` | Lets the per-spread table (§5) group the ledger without a `$lookup` to `readings`. `card_count` is the distinct count the word budget used. |

`model` is already stamped.

## 5. Per-spread cost table

The measured figures in
[`../reference/prompts/lean-prompt-architecture.md`](../reference/prompts/lean-prompt-architecture.md) §4
are two one-off experiments and go stale with every model change. Replace them with a read-only
table on the superadmin page, one row per `spread_type` × `model` seen in the ledger:

| Column | Source | Model-agnostic? |
|---|---|---|
| Cards | stamped `card_count` (mode per spread) | yes |
| Worst-case tokens and cost | `clamped_completion_cap` and `worst_case_cost_usd` on the current effort and current prices | the cap is; `REASONING_HEADROOM` was tuned on gpt-5.4 |
| Measured avg input / output / reasoning tokens, avg cost, sample size | one aggregation over `interpretations.usage` | **no**: reasoning tokens depend on the model |

The worst-case column is a property of the spread and is right the moment the model or prices
change. The measured columns are a property of the spread on a given model and restart for a new
model. The §4 table in the prompt doc becomes a pointer to this UI.

Truncations (`LengthFinishReasonError`, the signal that the headroom is too small for a new
model) stay in logs. If they turn out to matter, a counter document in the app-state collection
is the whole design; no new collection.

## 6. Superadmin ledger UI

Scope agreed: superadmin can see and change the ledger for one user or for all users, and set
the model and its prices.

| Action | One user | All users |
|---|---|---|
| See budget, spend this period, remaining, readings, last activity | Users table columns | Same table, plus totals |
| Set budget | Per-user override (`budget_usd`), or clear it back to the default | Change the app-wide default |
| Adjust spend | Reset this period to 0, or add/subtract an amount | Reset everyone's current period |
| Model and prices | | One card: model id, input and output $/1M, who changed it and when |
| What a reading costs | | The per-spread table (§5) |

- Backend, in the `users` domain, superadmin-only, as CQRS commands and queries registered in
  `main.py`: extend the listing with budget and usage; one command to set or clear a user's
  budget; one to adjust or reset a user's spend; one to reset all; one to set the default
  budget; one to set the model and prices (validates the model id, §1); one query for the
  per-spread table.
- Spend adjustments never touch `interpretations.usage`; the per-call ledger stays a faithful
  record of what calls cost. Each adjustment, like each settings change, is a structured log
  event with the acting admin's `user_id`, the target, and the before and after values.
- Spend cannot be set below 0. Bulk actions need an explicit confirmation in the UI.
- Frontend: extend `frontend/src/app/superadmin/page.tsx` and its actions. Every server action
  re-checks `isSuperadmin` itself (layouts do not protect actions; see `frontend/CLAUDE.md`).

## 7. Errors we accept

One reservation for a killed process (heals monthly); one reading for the concurrent
first-generate race; one reading of overshoot at the cap; one reservation at a month boundary;
price lag until the owner updates the card after an OpenAI price change. Provider waste stays
absorbed by the owner.

## 8. Out of scope

Any outbound price feed; reservation records or a reaper; exactly-once charging; cached-token
pricing; charging users for provider waste; reconcile or repair scripts; alarms against OpenAI's
Costs API; stored audit trail for admin changes; admin-editable reasoning effort or token cap.
The reading page keeps its single token total.

## 9. Suggested build order

1. Monthly period (§3), because it changes the gate every later step builds on.
2. Ledger stamp (§4), trivial and makes everything after it observable.
3. App-state collection and admin-set model and prices (§1, §2), including the per-call model
   on the adapter.
4. Superadmin backend (§6, §5 query), then UI.

Each step updates [`../reference/interpretations/usage-and-budget-flow.md`](../reference/interpretations/usage-and-budget-flow.md),
[`../reference/database/model-references.md`](../reference/database/model-references.md) and
[`../reference/interpretations/user-accounting.md`](../reference/interpretations/user-accounting.md);
step 4 also replaces the §4 table in
[`../reference/prompts/lean-prompt-architecture.md`](../reference/prompts/lean-prompt-architecture.md)
with a pointer. When all four steps are done, update those and delete this plan.

## 10. Decisions log

| Date | Decision |
|---|---|
| 2026-09-21 | Middle ground, not bullet-proof. Existing data is expendable. |
| 2026-09-21 | Budget becomes **monthly** (UTC calendar month, lazy rollover). |
| 2026-09-21 | Superadmin gets a **UI to change the ledger for one user or all users**. |
| 2026-09-21 | The reading page keeps **one token total**. |
| 2026-10-24 | The LiteLLM price feed is **dropped**. Model id and prices are **admin input** in the superadmin UI, seeded from env. Model id validated on save with `models.retrieve`. |
| 2026-10-24 | **Per-spread cost table** in the superadmin UI, grouped by spread × model, derived from the ledger plus the cap formula. No cost-profile collection. |
| 2026-10-24 | Usage rows stamp `spread_type` and `card_count` alongside the prices. |
| 2026-10-24 | `reasoning_effort` and `max_tokens` stay in env. Truncations stay in logs. Admin changes are logged, not stored. |

Still open, small: the price ceiling (proposed $1,000 per 1M).
