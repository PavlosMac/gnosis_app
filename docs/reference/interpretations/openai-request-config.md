# OpenAI Request Config: Concurrency and Timeouts

How the long-running OpenAI call is throttled, what the knobs do, and the order in
which to change them. The generate flow itself is in
[`usage-and-budget-flow.md`](usage-and-budget-flow.md).

## Where the throttle lives

The cap is an `asyncio.Semaphore` inside `OpenAIAdapter`
(`backend/src/llm/openai_adapter.py`), created once per process. Uvicorn plays no
part: it accepts every connection and runs them on one event loop; the semaphore
decides how many of those may have an OpenAI request open at once. The rest wait in
FIFO order, costing almost nothing. Prod runs one uvicorn worker
(`backend/Dockerfile`), so the per-process cap is the real ceiling.

## The settings

All in `Settings` (`backend/src/core/config.py`), overridable by env var on the Pi
(`.env.gnosis.prod`); a change needs an api container restart.

| Env var | Default | What it does |
|---|---|---|
| `OPENAI_MAX_CONCURRENT` | 10 | In-flight OpenAI calls per process |
| `OPENAI_ACQUIRE_TIMEOUT_SECONDS` | 30 | Wait for a slot before giving up → **503**, reservation refunded |
| `OPENAI_TIMEOUT_SECONDS` | 120 | Per attempt → **504** on expiry |
| `OPENAI_MAX_RETRIES` | 2 | SDK retries on 429 / connection / timeout. A retrying call holds its slot: worst case 3 × 120 s |

The budget reservation is taken *before* the slot is acquired and released on any
failure, so a throttled user ends at $0 charged.

## What a burst does

Requests are served in batches of `max_concurrent`. With provider latency *L*, batch
*n* waits (n−1) × L for a slot and only batches under the acquire timeout survive.

| Provider latency | 100 concurrent users, cap 10, acquire 30 s |
|---|---|
| 2 s (load-test fake) | all 100 succeed in ~21 s |
| 10 s | 40 succeed, 60 get 503 |
| ≥ 30 s | 10 succeed, 90 get 503 |

Real gpt-5.4 latency has **not been measured**; the load tests
(`backend/tests/load/`, `make load-live`) use a 2 s fake. Throughput is roughly
`max_concurrent` readings per provider-latency window.

## Raising the cap: what it moves the bottleneck to

- **Provider rate limits.** Each request reserves its completion cap (up to
  `OPENAI_MAX_TOKENS`, 10,000) against the org's tokens-per-minute limit. 100 in
  flight ≈ 1M tokens reserved, above the lower OpenAI tiers → 429s.
- **Retries.** Provider 429s are retried twice while holding the slot, so the user
  failure shifts from a fast 503 to a slow 429 ("Too many requests").
- **Spend.** The semaphore is also a soft spend brake; past it only per-user budgets
  limit exposure.
- **The Pi.** Not a concern: idle coroutines and sockets are cheap.

## Plan, in order

1. **Do nothing until the logs show queueing.** A beta of ~10 users never fills 10
   slots; the single-request path is what to measure first.
2. **Measure real latency.** Grep prod logs for `openai call completed` and read
   `duration_s`. If calls approach 100 s, the Cloudflare tunnel's 100 s origin
   timeout returns a 524 to the browser while the backend still completes, charges
   and stores (the idempotent retry then returns the stored reading).
3. **Map 502/503/504 to a friendly message.** `SAFE_MESSAGES` in
   `frontend/src/lib/api-client.ts` covers 402 and 429 only; LLM errors reach the
   user as "An unexpected error occurred."
4. **Read the org's limits** in the OpenAI dashboard (Limits → the model in use).
5. **Size the cap:** `TPM ÷ 10,000 ÷ minutes-per-call` is a safe concurrency ceiling.
   Set `OPENAI_MAX_CONCURRENT` to that, restart, watch for `openai call failed` with
   `LLMRateLimitError`. If those appear, the provider is the limit and a higher cap
   only converts 503s into 429s.
6. **Only then** consider structural changes: a per-user in-flight limit, or the
   streaming plan (`docs/plans/2026-09-10-sse-streaming-interpretations.md`) which
   also removes the 100 s wall-clock problem.
