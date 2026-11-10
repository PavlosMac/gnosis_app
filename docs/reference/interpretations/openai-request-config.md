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

```
 browsers ──► Next.js server ──► uvicorn  (1 worker; accepts every connection)
                                    │
                                    ▼
  ┌───────────────────── one asyncio event loop ─────────────────────────┐
  │                                                                      │
  │  one coroutine per POST /readings/{id}/interpretation                │
  │  r1 … r100: reserve budget, then ask the semaphore for a slot        │
  │                                                                      │
  │  asyncio.Semaphore(OPENAI_MAX_CONCURRENT = 10)                       │
  │                                                                      │
  │  FIFO wait queue   (parked coroutines, no threads, ~free)            │
  │  ┌─────┬─────┬─────┬─────┬──────┐                                    │
  │  │ r11 │ r12 │ r13 │ ... │ r100 │ ◄── newest joins at the back       │
  │  └──┬──┴─────┴─────┴─────┴──────┘                                    │
  │     │  oldest moves up when a slot frees                             │
  │     │  waited > OPENAI_ACQUIRE_TIMEOUT_SECONDS (30) ──► 503, refund   │
  │     ▼                                                                │
  │  in-flight slots (10)                                                │
  │  ┌────┬────┬────┬────┬────┬────┬────┬────┬────┬─────┐                │
  │  │ r1 │ r2 │ r3 │ r4 │ r5 │ r6 │ r7 │ r8 │ r9 │ r10 │                │
  │  └──┬─┴────┴────┴────┴────┴────┴────┴────┴────┴─────┘                │
  │     │  each holds its slot for the whole call, retries included      │
  └─────┼────────────────────────────────────────────────────────────────┘
        ▼
     OpenAI    OPENAI_TIMEOUT_SECONDS (120) per attempt ──► 504
               OPENAI_MAX_RETRIES (2) further attempts on the same slot
```

### Uvicorn, workers and coroutines

A worker is a whole Python process with its own event loop. Within one loop,
coroutines take turns on a single thread: `await` hands the thread back while the
coroutine waits on I/O, so hundreds can be in flight while only one runs.

```
 uvicorn --workers N     (prod: N = 1, backend/Dockerfile)
   │
   ├── worker 1 ─ one Python process, one thread, one event loop
   │              one Semaphore(10), one Mongo pool, one OpenAI client
   │
   └── worker 2 ─ only if N = 2: a second process with its own loop and its
                  own Semaphore(10) → 20 in flight, nothing coordinating them


 one event loop, one thread: only one coroutine runs at any instant

 time ────────────────────────────────────────────────────────────────────►

 r1     ██─ await openai ───────────────────────────────────────██ done
 r2       ██─ await mongo ─██─ await openai ─────────────────────────██ done
 r3         ██─ await semaphore (queued, slot busy) ──────────██─ await openai ─ …
 login                ████████████ argon2 hash: CPU work, no await
                        ▲ loop frozen: r1, r2, r3 cannot resume until it ends

 ██  running on the CPU (microseconds to a few milliseconds)
 ─   waiting on I/O: the thread is free for every other coroutine
```

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
   slots; the single-request path is what to measure first. One cheap change to
   consider now: lower `OPENAI_MAX_RETRIES` to 1 or 0. The SDK's backoff (jittered,
   honours `Retry-After`) runs *while the slot is held*; for a waiting user a fast
   429/503 beats a slow one and frees the slot.
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
6. **Only then** consider structural changes:
   - **Token-bucket admission** instead of the fixed semaphore, if logs show provider
     429s while slots are still free. The provider's real limit is tokens per minute,
     not concurrent calls, and spreads differ ~8× in size (1 card vs 11): a fixed cap
     of 10 wastes capacity on small spreads and risks 429s on large ones. The adapter
     already computes the per-request completion cap at admission; a bucket refilled
     at the org's TPM/RPM and debited by that cap is the OpenAI cookbook's
     `api_request_parallel_processor` pattern.
   - A per-user in-flight limit.
   - The streaming plan (`docs/plans/2026-09-10-sse-streaming-interpretations.md`),
     which also removes the 100 s wall-clock problem.

## Why not the batch-processing patterns

The usual "thousands of requests" guides (semaphore + long exponential backoff,
pause the whole queue after a 429, retry queue) assume a batch job where nobody is
waiting and delay is free. Here a person is watching the shuffle and a budget
reservation is held for the duration, so anything past ~30 s is a failure whether or
not the request eventually succeeds. Fail fast (503/429) and let the idempotent
retry do the recovery; retry less, not more.


Going from 10 to 20 is safe on the Pi side and touches nothing in Mongo, uvicorn or memory. What it does change is your exposure to OpenAI's limits. Here is what to check or adjust, in order.

1. Your OpenAI tier's tokens-per-minute limit. Check before changing anything.
Each in-flight request reserves its completion cap against the org's TPM at admission, up to 10,000 tokens. Twenty in flight can reserve about 200,000 tokens at once. If your tier's TPM for the model is below that, raising the cap converts fast 503s into slow 429s with no gain. The safe ceiling is in the doc: TPM ÷ 10,000 ÷ minutes per call. Read the figure from r Limits for the model in use.

2. OPENAI_MAX_RETRIES, currently 2. Lower to 0 or 1.
With twice the slots, 429s from the provider become more likelyh one with backoff while holding the slot. A retrying call canhold a slot for three attempts of up to 120 seconds. The doc already recommends lowering this regardless; at 20 it matters more.

3. OPENAI_MAX_TOKENS, currently 10,000. Consider lowering.
This is the per-request reservation against TPM and the worst-case cost per call. Only the largest spreads derive anything near it. If the logs show
completion tokens well under it, a lower ceiling lets more requTPM. The adapter warns when a cap gets clamped, so you will seeif you go too low.

4. OPENAI_ACQUIRE_TIMEOUT_SECONDS, currently 30. Leave it.
The queue drains twice as fast, so fewer requests hit the cutof

5. Spend exposure. The semaphore is also a soft brake on org-wicall at gpt-5.4 output pricing is about $0.15, so a full batch of 20 is about $3 of exposure against an observed average of $0.02 per reading. Per-user budgets still cap each account at $3. Acceptable.

Nothing to change

- Mongo pool: the Motor default is 100 connections, and each reshort and not held during the call.
- Uvicorn: no concurrency limit configured, and idle coroutines are free.
- The load tests pass the cap explicitly per scenario, so they

Where the value lives

- Set OPENAI_MAX_CONCURRENT=20 in .env.gnosis.prod on the Pi and recreate the api container. Or change the default in src/core/config.py and rebuild, which also needs the .env.example comment.
- Update openai-request-config.md: the burst table assumes cap ed labels the slots as 10.

After the change, grep the prod logs for openai call failed with LLMRateLimitError. If those appear, the provider is the limit and the cap should come back down to what step 1 gave you.