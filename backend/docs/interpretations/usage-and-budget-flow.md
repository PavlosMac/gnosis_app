# Interpretation Generation: Usage & Budget Flow

How a reading turns into an OpenAI call, gets charged against a per-user budget, and
lands in the usage ledger. Design rationale lives in
[`docs/prompts/lean_prompt_architecture.md` §5a](../prompts/lean_prompt_architecture.md);
this doc is the "how it actually works" reference for the code as built.

## The one-step API shape

Generating an interpretation is a single idempotent call:

**`POST /readings/{reading_id}/interpretation`** — no request body. On the first call
for a reading it calls the LLM, charges the budget, **persists the interpretation**,
and returns it (`{interpretation, remaining_budget_usd}` — the nested object is
exactly what `GET /readings/{id}` embeds as its singular `interpretation` field). On
any later call it returns the stored interpretation without touching the LLM or the
budget — one interpretation per reading, generated once. There is no preview and no
separate save endpoint; there are no interpretation settings.

## Where the money and the words live

| Field | Where | What it is |
|---|---|---|
| `users.usage` | one per user | Running spend aggregate: `{prompt_tokens, completion_tokens, cost_usd, readings, updated_at}`. **Created lazily** — absent until a user's first reservation. |
| `users.budget_usd` | one per user, optional | Per-user override of the default cap. Absent means "use the default." |
| `Settings.user_budget_usd` | config, `$3.00` default | The fallback budget when a user has no override. |
| `interpretations.usage` | one per saved interpretation | The audit trail: exact tokens and cost for *that one reading*, frozen at save time. |

The user aggregate answers "how much has this user spent, and can they spend more."
The per-interpretation ledger answers "why did this specific reading cost what it
cost." They're deliberately separate documents with separate jobs.

## The generate flow, step by step

Everything below happens inside `GenerateInterpretationHandler.handle`
(`src/interpretations/commands/generate_interpretation.py`):

1. **Fetch the reading, the user, and any stored interpretation concurrently**
   (`asyncio.gather` — the three lookups don't depend on each other). 404s if the
   reading doesn't exist or isn't owned by the caller — ownership is checked *before*
   the idempotency return, so an existing interpretation never leaks to a non-owner.
2. **Resolve the budget.** `user.budget_usd` if the field is present, else
   `Settings.user_budget_usd`. This is a `None` check, not a truthiness check — a user
   explicitly capped at `budget_usd: 0` must actually be blocked, not silently fall
   back to the $3 default.
3. **Idempotency short-circuit.** If the reading already has its interpretation,
   return it with `remaining_budget_usd` computed live from the user aggregate —
   no reservation, no LLM call, no charge.
4. **Compute the worst-case reservation** — `worst_case_cost_usd()`
   (`src/llm/pricing.py`): the full completion-token cap (clamped to
   `Settings.openai_max_tokens`, same clamp the adapter itself enforces) at the
   configured model's output price, plus a conservative estimate of the prompt tokens
   at its input price. This is a ceiling, not a prediction — it's what the gate holds
   in reserve, not what gets charged.
5. **Reserve, atomically** — `AuthWriteRepository.reserve_usage()` does one filtered
   `find_one_and_update`: grant only if `spend_so_far < budget`. Missing `usage.cost_usd`
   (a brand-new user) is treated as spend of `0`, not as "exempt from the check" — see
   [Need to know](#need-to-know) below. Refused reservations raise
   `BudgetExceededError` → **402**.
6. **Call the LLM.** Whatever adapter is wired (`OpenAIAdapter` in production,
   `MockLLMAdapter` in dev/tests — always `$0`, zero tokens).
7. **Persist the interpretation** — `upsert_by_reading_id` keyed on `reading_id`
   alone, still inside the reserve window. Persist sits deliberately *before* settle:
   a persist failure releases the reservation (nothing stored, nothing charged), and
   a settle failure leaves the doc stored but charged $0 — charged-with-nothing-stored
   is impossible.
8. **Settle to actuals** — `AuthWriteRepository.settle_usage()` adjusts the reservation
   down (or up, if actuals somehow exceed the estimate) to the real cost, and records
   the token split + increments the reading count on the user aggregate.
9. **On any failure between reserve and settle** (LLM error, persist error, timeout,
   even task cancellation) — the reservation is released in full. The user is never
   charged for a reading they didn't receive; wasted provider spend is logged, not
   billed.

Steps 5–9 are wrapped by `reserve_budget()` (`src/auth/service.py`), an async context
manager that owns the reserve/release-on-failure choreography so any future
paid-LLM feature can reuse it instead of hand-rolling the same try/except:

```python
async with reserve_budget(user_write_repo, user_id, reserved, budget):
    response = await llm.generate_interpretation(request)
    ...  # compute actual cost, settle_usage() — the caller still owns this part,
         # since only it knows the actual cost once the call returns
```

The response carries the stored `interpretation` (its `usage` sub-object is the exact
split + cost for this call) and `remaining_budget_usd` (`budget - total_spend`,
floored at `0`).

## Pricing

`src/llm/pricing.py` resolves `$/1M tokens` from `Settings.model_price_table`
(`src/core/config.py`), matched by **longest prefix** against the model id the
provider actually returns (e.g. `gpt-5.4-2026-01-15` matches the `gpt-5.4` entry, not
some hypothetical `gpt-5` entry, and never the `gpt-5.4-mini` entry). Cost is priced at
the moment of the call and stored — a later price-table edit never rewrites history for
readings already saved.

An id that matches nothing in the table is priced at the table's most expensive entry
(with a warning logged) rather than failing the reading — a price-table gap should
never be the reason a user can't get their reading.

## Need to know

- **A `budget_usd: 0` override must be checked with `is not None`, never `or`.** `0 or
  default` evaluates to `default` — this was a real bug (fixed) where an admin
  capping a user at $0 silently gave them the $3 default instead.
- **A brand-new user's very first reservation is still budget-checked.** The `usage`
  subdocument doesn't exist until the gate creates it, but `reserve_usage`'s filter
  uses `$expr` + `$ifNull` to treat "no usage yet" as spend of `$0`, not as "skip the
  check." (An earlier version used an `$or` with `usage.cost_usd: {$exists: false}`
  that granted *any* first request unconditionally, regardless of budget — also fixed.)
- **The reservation ceiling is clamped to `Settings.openai_max_tokens`,** the same
  clamp `OpenAIAdapter` applies before calling the provider. If the reservation math
  and the adapter's clamp ever drift apart, the gate can either over-reserve
  (false `BudgetExceededError` on a request that would've fit) or under-reserve
  (a real overspend risk) — `worst_case_cost_usd()` and the adapter must keep
  computing the same cap.
- **Concurrent requests can't stack past the cap.** Because reserve is one atomic
  `find_one_and_update`, a second in-flight request already sees the first
  reservation and is refused — the budget can be exceeded by at most one reservation
  in flight, not once per parallel request.
- **`"mock"` is a real (free) entry in the price table,** not a fallback case. Every
  local/test call goes through it silently instead of tripping the "unknown model"
  warning on every single dev/test run.
- **Two concurrent first-generates for the same reading can both charge.** Both pass
  the existence check before either persists; the `reading_id`-keyed upsert makes
  storage last-write-wins (one document, no `E11000`). This is the same accepted race
  posture as the gate itself, bounded by its at-most-one-reservation overshoot.

## Quick file map

| Concern | File |
|---|---|
| Generate handler (orchestrates the whole flow) | `src/interpretations/commands/generate_interpretation.py` |
| Budget gate (reserve/settle/release + `BudgetExceededError`) | `src/auth/service.py`, `src/auth/repository.py` |
| Worst-case reservation math, price table lookups | `src/llm/pricing.py` |
| Prompt construction, per-spread word/token budget | `src/llm/prompt_builder.py` |
| Price table, default budget, model/token settings | `src/core/config.py` |
| User's `usage`/`budget_usd` fields | `src/auth/models.py` |
| Per-interpretation ledger schema | `src/interpretations/schemas.py` (`InterpretationUsage`) |
| Interpretation storage (`upsert_by_reading_id`) | `src/interpretations/repository.py` |

## Tests to read first

- `tests/auth/test_repository.py` — the budget gate in isolation (reserve/settle/release,
  including the brand-new-user and zero-budget edge cases).
- `tests/interpretations/test_commands.py` — idempotency (`# --- Idempotency ---`) and
  the gate wired into the full generate flow (`# --- Budget gate ---`), including the
  persist-failure, settle-failure, and concurrency tests.
- `tests/llm/test_pricing.py` — price-table resolution and the worst-case clamp.
