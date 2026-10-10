# User accounting: price source, monthly period, superadmin ledger

**Status:** agreed design, not started (agreed 2026-09-21; split out of the reference doc 2026-10-10).

What the ledger does today, every file involved and the known gaps are in
[`../reference/interpretations/user-accounting.md`](../reference/interpretations/user-accounting.md).
This plan is the follow-up agreed that day.


Principles: smart, minimal calls; errors small, bounded and self-healing; no scheduler; existing
data is expendable, so shapes change without backfills.

## 1. Price source

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

## 2. Refresh: at most one fetch per window

- **One Mongo document** holds the working price table (only our models) plus `fetched_at` and
  `next_check_at`. It lives in a small app-state collection shared with the budget default (§4).
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

## 4. Superadmin ledger UI

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

## 5. Ledger stamp

Each `interpretations.usage` row also records the unit prices used and their source (`list` or
`config`). Cost stays frozen at call time. Any later over- or under-charge question is a query.

## 6. Errors we accept

One reservation for a killed process (heals monthly); one reading for the concurrent
first-generate race; one reading of overshoot at the cap; one reservation at a month boundary;
up to one refresh window of price lag. Provider waste stays absorbed by the owner.

## 7. Out of scope

Reservation records or a reaper, exactly-once charging, cached-token pricing, charging users for
provider waste, reconcile or repair scripts, alarms against OpenAI's Costs API. The reading page
keeps its single token total.

## 8. Suggested build order

1. Monthly period (§3), because it changes the gate every later step builds on.
2. Ledger stamp (§5), trivial and makes the price work observable.
3. Price cache and refresh (§1, §2).
4. Superadmin backend, then UI (§4).

Each step updates [`../reference/interpretations/usage-and-budget-flow.md`](../reference/interpretations/usage-and-budget-flow.md),
[`../reference/database/model-references.md`](../reference/database/model-references.md) and
[`../reference/interpretations/user-accounting.md`](../reference/interpretations/user-accounting.md).
When all four steps are done, update those and delete this plan.

## 9. Decisions log

| Date | Decision |
|---|---|
| 2026-09-21 | Middle ground, not bullet-proof. Existing data is expendable. |
| 2026-09-21 | Budget becomes **monthly** (UTC calendar month, lazy rollover). |
| 2026-09-21 | The LiteLLM price list is **accepted** as the source, with the guard rails in §1. |
| 2026-09-21 | Superadmin gets a **UI to change the ledger for one user or all users**. |
| 2026-09-21 | The reading page keeps **one token total**. |

Still open, small: the bound factor (proposed 2x); the refresh window (3 or 4 days); whether
admin spend adjustments need a stored audit trail beyond structured logs (proposed: logs only).
