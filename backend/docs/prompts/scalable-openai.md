# Scalable OpenAI Adapter — Implementation Plan

## Status: Superseded — folded into [`docs/lean-prompt-migration-plan.md`](../lean-prompt-migration-plan.md) Phase 2 on 2026-09-01. Kept for reference; do not implement from this doc.
## Date: 2026-04-03 (superseded 2026-09-01)

> **Deltas applied in the fold** (the migration plan is authoritative):
>
> - Timeout default raised 60s → **120s** — the lean architecture's 11-card spreads on
>   `gpt-5.4` with reasoning (~3,400 output tokens) outgrew the "1–3 card reading"
>   rationale below.
> - `except APITimeoutError` must precede `except APIConnectionError` — it *subclasses*
>   it in the OpenAI SDK, so the order below would silently map timeouts to 502.
> - Semaphore acquire gets a **bounded wait** → 503 instead of unbounded queueing; note
>   the semaphore is per-process (effective cap × uvicorn workers).
> - Item 4 was only partially implemented: success-path usage logging exists, but call
>   duration and failure-path logging are still outstanding and stay in scope.
> - Item 5 (response caching) **dropped entirely** — it conflicts with the per-user
>   budget ledger (a cache hit either double-charges or breaks the one-charge-per-
>   interpretation-doc invariant), and cost is ~95% output-dominated anyway.
> - Test path is `tests/llm/`, not `tests/test_llm/`.

---

## Context

The `OpenAIAdapter` (`src/llm/openai_adapter.py`) is fully async and correctly uses `AsyncOpenAI` with proper error mapping to domain exceptions. However, it lacks production-grade scalability controls — concurrency limiting, explicit timeouts, retry configuration, and structured logging for observability under load.

### Current State (What's Good)

- Fully async I/O via `AsyncOpenAI` — non-blocking
- Card catalog and prompt building are pure in-memory operations — no blocking I/O
- Error hierarchy maps SDK exceptions to domain errors (`LLMRateLimitError`, `LLMConnectionError`, `LLMResponseError`)
- `LLMPort` ABC keeps the adapter swappable

### Gaps

| Gap | Risk | Severity |
|-----|------|----------|
| No concurrency control | Unbounded concurrent OpenAI calls exhaust connection pool or trigger mass rate-limits | High |
| No explicit request timeout | A hung OpenAI call ties up a worker for up to 600s (SDK default) | High |
| No retry configuration | SDK default `max_retries=2` is implicit; no backoff tuning for rate-limits | Medium |
| No observability on call duration/failures | Hard to diagnose latency or failure patterns under load | Medium |
| No response caching | Identical requests always hit OpenAI — unnecessary cost/latency | Low |

---

## Plan

### 1. Add Concurrency Semaphore

**File**: `src/llm/openai_adapter.py`

Add an `asyncio.Semaphore` to cap in-flight OpenAI calls. The limit is configurable via settings.

```python
import asyncio

class OpenAIAdapter(LLMPort):
    def __init__(
        self, client: AsyncOpenAI, model: str, max_tokens: int, max_concurrent: int
    ) -> None:
        self._client = client
        self._model = model
        self._max_tokens = max_tokens
        self._semaphore = asyncio.Semaphore(max_concurrent)

    async def generate_interpretation(self, request: InterpretationRequest) -> InterpretationResponse:
        # ... card lookup + prompt building (unchanged) ...

        async with self._semaphore:
            try:
                response = await self._client.beta.chat.completions.parse(...)
            except ...:
                ...
```

**File**: `src/core/config.py`

```python
openai_max_concurrent: int = 10
```

**File**: `src/main.py` — pass new setting to adapter constructor.

### 2. Add Explicit Request Timeout

**File**: `src/llm/openai_adapter.py`

Pass a `timeout` parameter to the `.parse()` call. Also add a new `LLMTimeoutError` and catch `httpx.TimeoutException` (which the SDK raises when the timeout fires).

```python
from openai import APITimeoutError

class OpenAIAdapter(LLMPort):
    def __init__(
        self, client: AsyncOpenAI, model: str, max_tokens: int,
        max_concurrent: int, timeout: float,
    ) -> None:
        ...
        self._timeout = timeout

    async def generate_interpretation(self, ...):
        ...
        try:
            response = await self._client.beta.chat.completions.parse(
                ...,
                timeout=self._timeout,
            )
        except APITimeoutError as exc:
            raise LLMTimeoutError() from exc
        ...
```

**File**: `src/llm/errors.py`

```python
class LLMTimeoutError(LLMError):
    def __init__(self, detail: str = "LLM request timed out"):
        super().__init__(status_code=504, detail=detail)
```

**File**: `src/core/config.py`

```python
openai_timeout_seconds: float = 60.0
```

### 3. Configure Explicit Retry Policy on the Client

**File**: `src/main.py`

Configure `max_retries` explicitly on the `AsyncOpenAI` client constructor so the retry behaviour is visible and tuneable rather than relying on the implicit default.

```python
openai_client = AsyncOpenAI(
    api_key=settings.openai_api_key,
    max_retries=settings.openai_max_retries,
)
```

**File**: `src/core/config.py`

```python
openai_max_retries: int = 2
```

### 4. Add Structured Logging for Observability

**File**: `src/llm/openai_adapter.py`

Log call duration, token usage, model, and outcome (success / error type) at `info` level so production metrics are available without external instrumentation.

```python
import time

async def generate_interpretation(self, request: ...):
    ...
    start = time.monotonic()
    try:
        async with self._semaphore:
            response = await self._client.beta.chat.completions.parse(...)
        elapsed = time.monotonic() - start

        logger.info(
            "openai call completed",
            model=response.model,
            tokens=response.usage.total_tokens if response.usage else 0,
            duration_s=round(elapsed, 3),
            cards=[c.name for c in request.cards],
        )
    except <LLM errors> as exc:
        elapsed = time.monotonic() - start
        logger.warning(
            "openai call failed",
            error=type(exc).__name__,
            duration_s=round(elapsed, 3),
        )
        raise
```

### 5. (Optional / Future) Response Caching

**Not in scope for this iteration** — flagged for later. A short-TTL in-memory cache (keyed on `hash(question + cards + orientations)`) could reduce cost for repeated identical queries. This would live as a decorator or wrapper around the adapter, not inside it, to keep `OpenAIAdapter` single-responsibility.

---

## Files Changed

| File | Change |
|------|--------|
| `src/llm/openai_adapter.py` | Semaphore, timeout, structured logging |
| `src/llm/errors.py` | Add `LLMTimeoutError` |
| `src/core/config.py` | Add `openai_max_concurrent`, `openai_timeout_seconds`, `openai_max_retries` |
| `src/main.py` | Pass new settings to `AsyncOpenAI` client and `OpenAIAdapter` constructor |
| `tests/test_llm/test_openai_adapter.py` | Tests for semaphore, timeout, and error paths |

## Testing Strategy

- **Unit tests**: Mock `AsyncOpenAI` to verify:
  - Semaphore limits concurrent calls (launch N+1 tasks, assert only N proceed simultaneously)
  - `APITimeoutError` maps to `LLMTimeoutError` with 504
  - Structured log events are emitted on success and failure
- **Existing tests**: Must continue passing — changes are additive (new constructor params have sensible defaults in tests)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Semaphore too low → starves throughput | Make configurable via env var; default 10 is conservative but safe |
| Timeout too aggressive → cuts off valid slow responses | Default 60s is generous for a 1-3 card reading; tuneable per env |
| Adding constructor params breaks existing test fixtures | Use keyword args with defaults in test helpers |

---

## Out of Scope

- Response caching (separate future task)
- Circuit breaker pattern (overkill at current scale)
- Multi-provider failover (e.g. fall back to Anthropic) — port abstraction supports this but not needed yet
