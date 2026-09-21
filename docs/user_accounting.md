# User Accounting

**Status:** reference + agreed design. Sections 1 to 7 describe the code as it stands on
2026-09-21. Section 8 is the design agreed with Pavlos that day and **is not built yet**. Section 9
logs the decisions and the few details still open. **Read this before touching anything that prices, reserves, debits or displays a
user's LLM spend**, and update it in the same change.

Step-by-step detail of the generate flow lives in the backend's Live doc,
[`backend/docs/interpretations/usage-and-budget-flow.md`](../backend/docs/interpretations/usage-and-budget-flow.md).
This doc is the map around it: every file involved on both sides, the data shapes, the known
gaps, and where we are taking it.

## 1. Purpose and stance

Every AI interpretation costs real money at OpenAI. Each user has a dollar budget (default
$3.00). The backend prices each call from the tokens the provider reports, debits the user, and
refuses new interpretations once the budget is used up.

The stance, set by Pavlos on 2026-09-21: **a sensible middle ground, not a bullet-proof ledger.**
A typical reading costs 1 to 4 cents, so almost no user ever approaches the cap. We want numbers
that are right in normal operation, errors that are small, bounded and self-healing, and as few
moving parts and outbound calls as possible. We do not want reservation tables, exactly-once
machinery or a billing-grade audit trail. The app is not in production, so existing data carries
no weight: shapes may change freely and nothing needs a backfill.

## 2. How it works today

One endpoint, `POST /api/v1/readings/{id}/interpretation`, handled by
`GenerateInterpretationHandler`:

1. Load the reading, the user and any stored interpretation together.
2. If an interpretation already exists, return it. No model call, no charge (idempotent).
3. **Reserve** a worst-case amount on `users.usage.cost_usd` in one atomic filtered update that
   also refuses when spend has already reached the budget (HTTP 402).
4. Call the model.
5. **Price** the call from the provider's reported input and output tokens.
6. **Persist** the interpretation with its own `usage` row (the per-call ledger).
7. **Settle**: move the user's spend from the reserved amount to the actual cost and add the
   token counts.
8. On any exception or cancellation in steps 4 to 7, **release** the full reservation.

Output tokens dominate the cost (six times the input price, and hidden reasoning tokens are
billed as output). The Significators chart is the most expensive spread: 1.5 times the per-card
word budget, up to seven cards.

## 3. Core code inventory

Paths are from the repo root. Symbols, not line numbers, so this survives edits.

### Backend: prices and settings

| File | Symbols | Role |
|---|---|---|
| `backend/src/core/config.py` | `model_price_table` | Hand-typed `{model: ($/1M input, $/1M output)}`. Today `gpt-5.4` (2.50, 15.00), `gpt-5.4-mini` (0.75, 4.50), `mock` (0, 0). Overridable as JSON via env `MODEL_PRICE_TABLE`, which no env file sets. |
| | `user_budget_usd` | Default per-user cap, $3.00. |
| | `openai_model`, `openai_reasoning_effort`, `openai_max_tokens`, `openai_max_retries` | Model choice, reasoning effort, completion ceiling, SDK retries (2). |
| | `llm_words_per_card`, `significator_budget_scale` | Word budget per card (100) and the Significators multiplier (1.5). These size the output, so they size the cost. |

### Backend: cost math

| File | Symbols | Role |
|---|---|---|
| `backend/src/llm/pricing.py` | `resolve_prices` | Maps a resolved model id such as `gpt-5.4-2026-03-05` to a table key (longest key wins). An unknown model is priced at the most expensive entry with a warning, so a table gap never fails a reading. |
| | `_is_dated_snapshot_of` | Tells a dated snapshot of a key apart from a different model sharing its prefix. |
| | `cost_usd` | `prompt/1e6 * in_price + completion/1e6 * out_price`. The single pricing formula. |
| | `worst_case_cost_usd` | The reservation: full completion cap at the output price plus a prompt estimate (`_CHARS_PER_TOKEN = 3`) at the input price. |
| `backend/src/llm/prompt_builder.py` | `total_word_budget`, `request_word_budget`, `distinct_card_count` | Word budget for a request (Significators dedupes repeated cards). |
| | `max_completion_tokens`, `clamped_completion_cap`, `TOKENS_PER_WORD`, `RESPONSE_OVERHEAD_TOKENS`, `REASONING_HEADROOM` | Words to a completion-token cap. The adapter and the reservation must compute the same cap. |

### Backend: provider usage

| File | Symbols | Role |
|---|---|---|
| `backend/src/llm/openai_adapter.py` | `_extract_usage` | Reads `prompt_tokens`, `completion_tokens` and `completion_tokens_details.reasoning_tokens` from the response. Cached input tokens are not read. |
| | `LengthFinishReasonError` branch | Truncated response: logs the wasted provider spend, raises, user is not charged. |
| `backend/src/llm/schemas.py` | `LLMUsage`, `InterpretationResponse` | The adapter's usage shape and return value. |
| `backend/src/llm/mock_adapter.py` | | Model `mock`, zero usage, free. Used when `OPENAI_API_KEY` is unset. |
| `backend/src/llm/errors.py` | | LLM failures mapped to 429 / 502 / 503 / 504. Every one releases the reservation. |
| `backend/src/main.py` | `AsyncOpenAI(max_retries=...)` | Where SDK retries are configured. |

### Backend: budget gate and aggregate

| File | Symbols | Role |
|---|---|---|
| `backend/src/auth/service.py` | `reserve_budget` | Async context manager: reserve on entry, release on any `BaseException`. Any future paid feature should wrap its call in this. |
| | `effective_budget_usd`, `remaining_budget_usd` | Per-user override if present (checked with `is not None`, so $0 blocks), else the default; remaining floored at 0. |
| | `BudgetExceededError` | HTTP 402, `"Usage budget exhausted"`. |
| `backend/src/auth/repository.py` | `reserve_usage` | The atomic gate: one `find_one_and_update` filtered on `usage.cost_usd < budget` (missing usage counts as 0) that `$inc`s the reservation. |
| | `settle_usage` | `$inc` spend by `actual - reserved`, add tokens, `readings += 1`, set `updated_at`; returns total spend. |
| | `release_usage` | `$inc` spend by `-reserved`. |
| | `find_dashboard_fields` | Projection for the dashboard: `budget_usd` and `usage.cost_usd` only. |
| `backend/src/auth/models.py` | `User.usage`, `User.budget_usd` | Domain round-trip; both omitted from the document when unset. |

### Backend: call site, ledger, readers

| File | Symbols | Role |
|---|---|---|
| `backend/src/interpretations/commands/generate_interpretation.py` | `GenerateInterpretationHandler` | The only place that charges a user. |
| `backend/src/interpretations/schemas.py` | `InterpretationUsage`, `InterpretationReadModel.usage`, `GeneratedInterpretationResponse.remaining_budget_usd` | The ledger row shape and the API response. |
| `backend/src/interpretations/models.py`, `repository.py` | `upsert_by_reading_id` | One interpretation per reading; concurrent first-generates are last-write-wins. |
| `backend/src/dashboard/queries/get_dashboard_by_user_id.py`, `schemas.py` | | `GET /api/v1/dashboard` returns `budget_usd` and `remaining_budget_usd`. |
| `backend/src/llm/router.py` | `POST /api/v1/llm/interpret` | Superadmin-only prompt testing. **Bypasses accounting entirely**: no reservation, no ledger, no persistence. |
| `backend/src/users/` | `AdminUserResponse` | The superadmin listing exposes no budget or usage. |
| `backend/src/migrations/versions/009_user_usage_accounting.py` | | Only unsets the legacy `total_tokens_used`. The usage fields are created lazily, never backfilled. |

### Frontend

| File | Symbols | Role |
|---|---|---|
| `frontend/src/types/interpret.ts` | `InterpretationUsage`, `GenerateInterpretationResult` | Wire types, mirroring the backend. |
| `frontend/src/types/auth.ts` | `DashboardResponse`, `Dashboard`, `mapDashboardResponse` | Budget fields for the profile page. |
| `frontend/src/app/user/interpret/actions.ts` | `generateInterpretation` | Server action; carries `remainingBudgetUsd`. |
| `frontend/src/app/user/profile/actions.ts` | `getDashboard` | Fetches the dashboard. |
| `frontend/src/components/InterpretationModal.tsx` | remaining-budget line | "Saved to your journal · Remaining Oracle budget $X". |
| `frontend/src/app/user/readings/[id]/InterpretationSection.tsx` | token label | "Model: … · N tokens", where N is input plus output added together. Cost and the split are never shown, which is why the label looks cheaper than the bill. |
| `frontend/src/components/BudgetChalice.tsx`, `frontend/src/app/user/profile/AccountPanel.tsx`, `frontend/src/lib/profile-dashboard.ts` | `chaliceFill`, `chaliceState`, `budgetCaption`, `formatUsd` | The budget chalice and its caption. |
| `frontend/src/lib/api-client.ts` | `SAFE_MESSAGES[402]` | "Your Oracle budget is exhausted." The only budget-exhausted handling; no dedicated UI state. |
| `frontend/src/app/superadmin/page.tsx` | | Users table. No spend or budget column. |

## 4. Data shapes

`users.usage`, created lazily by the first reservation:

| Field | Type | Notes |
|---|---|---|
| `cost_usd` | float | Spend so far, including any in-flight reservation. Lifetime total: **nothing ever resets it.** |
| `prompt_tokens`, `completion_tokens` | int | Added at settle. |
| `readings` | int | Settled calls. |
| `updated_at` | datetime | Last settle. Not a period boundary. |

`users.budget_usd`: optional float override of the default cap. **Nothing in the code writes
it**; today it is set by editing Mongo by hand.

`interpretations.usage`, one per interpretation (the per-call ledger):
`prompt_tokens`, `completion_tokens`, `reasoning_tokens`, `model` (resolved id), `cost_usd`
(frozen at call time, never re-derived).

Not stored anywhere: the unit prices that produced `cost_usd`, where those prices came from,
cached input tokens, and reasoning tokens on the user aggregate.

## 5. Tests that pin the behaviour

| File | Covers |
|---|---|
| `backend/tests/llm/test_pricing.py` | Cost formula, dated-snapshot matching, longest key wins, unknown-model fallback, reservation covers the cap and respects the clamp. |
| `backend/tests/auth/test_repository.py` | Reserve grants and refuses (new user, zero budget, at budget), settle adjusts to actuals, release returns the reservation. |
| `backend/tests/auth/test_service.py` | Remaining-budget arithmetic, overrides, floor at zero. |
| `backend/tests/interpretations/test_commands.py` | Settle to exact actuals, idempotent repeat is free, refusal when exhausted, per-user override, release after a failed call and a failed persist, settle failure charges nothing, concurrent requests cannot stack overshoot. |
| `backend/tests/interpretations/test_router.py` | 402 body. |
| `backend/tests/dashboard/test_queries.py`, `test_router.py` | Remaining budget on the dashboard. |
| `backend/tests/llm/test_adapter.py`, `test_lean_prompt.py` | Usage extraction, truncation mapping, completion-cap derivation and clamp, word budgets. |
| `frontend/src/lib/__tests__/profile-dashboard.test.ts`, `frontend/src/components/__tests__/BudgetChalice.test.tsx` | Chalice fill, state, caption, formatting. |

Untested: `POST /llm/interpret`, the frontend 402 message, `remainingBudgetUsd` plumbing, the
token label.

## 6. Related docs

| Doc | Status | Why it matters |
|---|---|---|
| `backend/docs/interpretations/usage-and-budget-flow.md` | Live | The step-by-step flow and its "need to know" list. |
| `backend/docs/database/model_references.md` | Live | Field reference for `users.usage`, `budget_usd`, `interpretations.usage`. |
| `backend/docs/database/production_mongo_commands.md` | Live | Ad-hoc spend queries (per month from the ledger, lifetime per user). |
| `backend/docs/prompts/lean_prompt_architecture.md` §5a | Live | The original design rationale for the ledger and gate. |
| `backend/docs/sse-streaming-interpretations-and-call-time-logging.md` | Plan | Would move settle and release into a background task; must be reconciled with this doc if started. |
| `frontend/docs/profile-dashboard.md`, ADR-004 / ADR-005 / ADR-008 in `frontend/docs/project_notes/decisions.md` | Live | Server-owned word budget, the one-endpoint response shape, the chalice. |

## 7. Known gaps

| Gap | Favours | Size | Note |
|---|---|---|---|
| Prices are hand-typed | Either | Silent drift until someone edits the table | **OpenAI has no endpoint for model prices** (checked 2026-09-21). See section 8. |
| Budget never resets | Owner | A user who spends $3 over two years is locked out | Pavlos thinks of spend per month; the code has a lifetime cap. |
| Process death between reserve and settle | Owner | One reservation, about 6 to 9 cents, stuck forever | Release only runs if the Python process survives (deploy, restart, dev auto-reload). |
| Concurrent first-generates for one reading | Owner | One extra reading's cost | Both pass the existence check and both settle. Accepted race; the UI blocks double clicks. |
| Provider waste is absorbed | User | Small | Truncated responses, failures after billing, and SDK retries are not charged to the user. Truncation is logged. |
| Cached input tokens billed at full input rate | Owner | Negligible | Our prompts are mostly below the size where provider caching applies. |
| Overshoot by one reading | User | One reading | The gate admits any request while spend is below the cap. By design. |
| `/llm/interpret` bypasses accounting | n/a | Superadmin only | Spend appears only in adapter logs. |
| No way to set or see budgets without Mongo | n/a | Ops friction | No endpoint, script or admin UI writes `budget_usd` or shows spend. |
| Token label hides the split | n/a | Confusing | 3,055 "tokens" cost 3.5 cents because 2,165 of them were output. |
| No infrastructure for periodic work | n/a | | No scheduler, background task, cache or first-party HTTP client exists in `backend/src/`. `httpx` is a dev dependency only. |

## 8. Agreed design (not built yet)

Principles: smart, minimal calls; errors small, bounded and self-healing; no scheduler; existing
data is expendable, so shapes change without backfills.

### 8.1 Price source

There is no OpenAI price API. OpenAI's Costs API (`GET /v1/organization/costs`, Admin key, daily
buckets) reports what was billed; it cannot supply unit prices. The source is LiteLLM's price list:

```
https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json
```

Vetting, done 2026-09-21:

| Check | Result |
|---|---|
| Agreement with OpenAI's official pricing page | Exact, for `gpt-5.4`, `gpt-5.4-mini` and `gpt-5.4-nano`, on input, cached input and output (standard tier). |
| Who relies on it | The LiteLLM library itself loads this exact URL at import (`model_cost_map_url`), so every LiteLLM deployment prices from it. About 59k stars, 11.6k forks, MIT licence outside `enterprise/`. |
| Maintenance | Very active: the last 30 commits to the file span three days, mostly automated OpenRouter syncs. Dated snapshot ids such as `gpt-5.4-2026-03-05` are present as keys. |
| Error record | Real. About 18 issues titled "incorrect price", including a 10x overcharge on a Bedrock embedding model and a wrong launch price for an Anthropic model. Most errors are on third-party hosts (Bedrock, Vertex, SambaNova), fewer on first-party OpenAI entries, and they get fixed, but not instantly. |
| Stability of the URL | `main` is mutable: a bad commit is live the moment it merges. There is no versioned or signed release of the file. |
| Size and churn | 2.8 MB, about 4,300 entries, changing several times a day. A conditional GET will therefore almost never answer 304. |

Verdict: good enough as a source, **not** good enough to trust blindly. The guard rails below
are part of the design, not optional.

Guard rails:

- Accept an entry only if its key is a model we use (or a dated snapshot of one) and its
  `litellm_provider` is `openai`. Ignore the other 4,300 entries.
- Accept a price only if it is positive, below an absolute ceiling, and within a factor of the
  config value for that model when config has one (proposed: 2x either way). A rejected price
  keeps the current value and logs a warning that names both numbers.
- Log every accepted price change as its own event, so a change is visible the day it happens.
- `model_price_table` in config stays as the seed, the fallback, and the anchor for the bound.
  A genuine large OpenAI price change therefore needs a one-line config edit, on purpose.
- Standard-tier prices only. We do not use batch, flex, priority or long-context pricing.

### 8.2 Refresh: at most one fetch per window

- **One Mongo document** holds the working price table (only our models) plus `fetched_at` and
  `next_check_at`. It lives in a small app-state collection shared with the budget default (8.4).
- **Stale-while-revalidate.** Pricing always answers from the cached table. If `next_check_at`
  has passed, the request starts a background refresh and still prices with what it has. A
  reading never waits on GitHub.
- **Single flight.** The refresh first claims the window with one atomic update that moves
  `next_check_at` forward. Only the worker that wins fetches, so several workers or a burst of
  requests make one call.
- **Window:** 3 to 4 days on success; on failure keep the table and retry after some hours.
  At 2.8 MB per fetch that is roughly 25 MB a month. `If-None-Match` is sent because it is free,
  but see the churn row above: do not rely on 304s.
- Parse the file off the event loop (it is large), keep only our entries, then discard it.
- **In-process memo** of the document for a few minutes, so pricing adds no Mongo read per reading.
- **No scheduler.** Refresh is driven by traffic. An idle deployment makes zero calls.
- New runtime dependency `httpx` (dev-only today); new settings for the URL, the window and the
  bound factor.

### 8.3 Monthly budget period

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

### 8.4 Superadmin ledger UI

Scope agreed: superadmin can see and change the ledger for one user or for all users.

| Action | One user | All users |
|---|---|---|
| See budget, spend this period, remaining, readings, last activity | Users table columns | Same table, plus totals |
| Set budget | Per-user override (`budget_usd`), or clear it back to the default | Change the app-wide default |
| Adjust spend | Reset this period to 0, or add/subtract an amount | Reset everyone's current period |

- Backend, in the `users` domain, superadmin-only, as CQRS commands registered in `main.py`:
  extend the listing with budget and usage; one command to set or clear a user's budget; one to
  adjust or reset a user's spend; one to reset all; one to set the default budget.
- **The default budget moves out of env** into the app-state collection, so "all users" does not
  need a redeploy. `Settings.user_budget_usd` remains the seed when no document exists.
- Spend adjustments never touch `interpretations.usage`; the per-call ledger stays a faithful
  record of what calls cost. Each adjustment is logged as a structured event with the acting
  admin's `user_id`, the target, and the before and after values.
- Spend cannot be set below 0. Bulk actions need an explicit confirmation in the UI.
- Frontend: extend `frontend/src/app/superadmin/page.tsx` and its actions. Every server action
  re-checks `isSuperadmin` itself (layouts do not protect actions; see `frontend/CLAUDE.md`).

### 8.5 Ledger stamp

Each `interpretations.usage` row also records the unit prices used and their source (`list` or
`config`). Cost stays frozen at call time. Any later over- or under-charge question is a query.

### 8.6 Errors we accept

One reservation for a killed process (heals monthly); one reading for the concurrent
first-generate race; one reading of overshoot at the cap; one reservation at a month boundary;
up to one refresh window of price lag. Provider waste stays absorbed by the owner.

### 8.7 Out of scope

Reservation records or a reaper, exactly-once charging, cached-token pricing, charging users for
provider waste, reconcile or repair scripts, alarms against OpenAI's Costs API. The reading page
keeps its single token total.

### 8.8 Suggested build order

1. Monthly period (8.3), because it changes the gate every later step builds on.
2. Ledger stamp (8.5), trivial and makes the price work observable.
3. Price cache and refresh (8.1, 8.2).
4. Superadmin backend, then UI (8.4).

Each step updates `backend/docs/interpretations/usage-and-budget-flow.md`,
`backend/docs/database/model_references.md` and this doc.

## 9. Decisions

| Date | Decision |
|---|---|
| 2026-09-21 | Middle ground, not bullet-proof. Existing data is expendable. |
| 2026-09-21 | Budget becomes **monthly** (UTC calendar month, lazy rollover). |
| 2026-09-21 | The LiteLLM price list is **accepted** as the source, with the guard rails in 8.1. |
| 2026-09-21 | Superadmin gets a **UI to change the ledger for one user or all users**. |
| 2026-09-21 | The reading page keeps **one token total**. |

Still open, small: the bound factor (proposed 2x); the refresh window (3 or 4 days); whether
admin spend adjustments need a stored audit trail beyond structured logs (proposed: logs only).
