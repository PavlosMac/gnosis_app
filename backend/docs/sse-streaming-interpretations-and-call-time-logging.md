# SSE Streaming for Interpretations + Call-Time Logging

## Context

`POST /api/v1/readings/{reading_id}/interpretation` holds the HTTP connection ~30s for a 9-card reading. Investigation confirmed the cause: the prompt is tiny (~800 tokens — the lean architecture already fixed input size), but `gpt-5.4` at `reasoning_effort=medium` generates ~1,500–1,900 hidden reasoning tokens plus ~1,440 tokens of prose (900-word budget), non-streamed, awaited inline in the handler. The confirmed sample (`docs/prompts/experiments/lean_celtic-cross_gpt-5.4_medium.md`): 3,403 output tokens, 1,905 reasoning.

The user chose (via AskUserQuestion) to keep model/effort/word-budget as-is and fix **perceived** latency with **SSE streaming**, plus add **call-time logging**. Total generation time is unchanged; the narrative streams to the client as it generates.

**Existing timing**: the adapter already logs `duration_s` + tokens at INFO (`src/llm/openai_adapter.py:124-132`). Missing: request duration in `AccessLogMiddleware`, `request_id` correlation (never bound to structlog), TTFT, and wall-clock latency in the experiment harness.

## Verified SDK facts that shape the design (openai 2.30.0, checked in .venv)

1. **`event.parsed` is useless here**: the stream helper parses accumulated content with `jiter.from_json(..., partial_mode=True)`, which drops incomplete trailing strings. `LeanReading` (`src/llm/schemas.py:43-52`) is one big `reading: str`, so `parsed` stays `{}` for the whole generation. **Fix**: on each `content.delta`, re-parse `event.snapshot` ourselves with `jiter.from_json(snapshot.encode(), partial_mode="trailing-strings")`, read `["reading"]`, emit the suffix beyond what was already emitted (decoded prefix is monotonic; JSON escapes decode correctly).
2. **Usage is silently zero** unless `stream_options={"include_usage": True}` is passed to `.stream()` — forgetting it means every streamed reading settles to $0 (undercharging). Pin with a test asserting the kwarg.
3. `client.chat.completions.stream(...)` (non-beta, async CM) accepts `response_format=LeanReading`, `reasoning_effort`, `timeout`, `max_completion_tokens`. `LengthFinishReasonError`/`ContentFilterFinishReasonError` raise **during iteration** — the existing error mapping in `_call_openai` (`openai_adapter.py:151-178`) must wrap the iteration.
4. Middleware order (`src/main.py:144-145`): `RequestIDMiddleware` is outermost → contextvars bound there are visible to the access-log line.
5. `structlog.contextvars.merge_contextvars` is absent from the processor chain (`src/core/logging.py:10-16`).

## Key decisions

- **Structured output kept unchanged** (`response_format=LeanReading`); prose extracted via snapshot reparse + length-diff. O(n²) reparse total is single-digit ms at this size — comment it.
- **CQRS fit**: a stream can't go through `mediator.send`. Orchestration lives in a new `InterpretationStreamService` in `src/interpretations/service.py`, injected via `src/core/dependencies.py`. `start_stream()` is an **eager coroutine**: runs all pre-checks (404/401/402 raise `AppError` → real HTTP statuses via the global handler) and returns an async generator. Errors after headers are sent become `event: error` SSE events.
- **Backward compat**: same endpoint, **Accept-header negotiation**. `Accept: text/event-stream` → SSE; otherwise the existing mediator/JSON path byte-for-byte unchanged (existing tests untouched are the regression net). Frontend opts in with one header.
- **Budget**: reserved eagerly in `start_stream` via `reserve_usage()` directly (so 402 is a real status, pre-headers) — a commented deviation from the `reserve_budget` CM (`src/auth/service.py:37-57`); settle/release obligation moves to the background task. Charged-with-nothing-stored stays impossible.
- **Disconnect semantics**: generation runs in a background `asyncio.Task` feeding an `asyncio.Queue`; the SSE generator only drains the queue. Client disconnect does NOT cancel the task — generation completes, persists, settles (a retry returns the stored doc free; a ~30s reasoning call costs real money). Task refs in a module-level `set` with discard+log done-callback.
- **Idempotency**: existing interpretation → still SSE: single `event: done` with the stored payload, no deltas, no charge.
- **Heartbeats**: drain loop uses `asyncio.wait_for(queue.get(), timeout=settings.sse_heartbeat_seconds)` (new setting, default 5.0). Timeout before first delta → `event: reasoning` `{"elapsed_s": ...}`; after → comment `: keep-alive`. Covers the 10–15s reasoning silence.
- **SSE vocabulary**: `event: reasoning` `{"elapsed_s": 7.5}` · `event: delta` `{"text": "..."}` · `event: done` = `GeneratedInterpretationResponse` JSON · `event: error` `{"detail": "...", "status_code": 502}` · `: keep-alive`. All data JSON-encoded (keeps newlines from breaking SSE framing). Headers: `Cache-Control: no-cache`, `X-Accel-Buffering: no`.

## Phase 1 — Logging (independent, do first)

Tests first — new `tests/core/test_middleware.py` (+ empty `tests/core/__init__.py`):
- `test_access_log_includes_duration` — `structlog.testing.capture_logs()` around a request (not `/api/v1/health`, it's in `_SKIP_PATHS`); assert `duration_ms` on the `"request"` entry.
- `test_request_id_bound_into_contextvars` — drive `RequestIDMiddleware` around a minimal ASGI endpoint reading `structlog.contextvars.get_contextvars()["request_id"]` (capture_logs strips merge_contextvars).
- `test_x_request_id_header_echoed_and_propagated`.

Changes:
1. `src/core/logging.py` — insert `structlog.contextvars.merge_contextvars` as the **first** entry of `shared_processors` (flows into both `configure()` and `foreign_pre_chain`). This alone puts `request_id` on the existing "openai call completed" line — including from the Phase 3 background task (contextvars are captured at `create_task`).
2. `src/core/middleware.py` — `RequestIDMiddleware.dispatch`: wrap `call_next` in `with structlog.contextvars.bound_contextvars(request_id=request_id):`. `AccessLogMiddleware.__call__`: `time.perf_counter()` bracket, add `duration_ms` to the `finally` log (for streaming responses `await self.app(...)` returns after the body completes → duration covers the full stream, which is what we want).
3. `scripts/lean_prompt_test.py` — `perf_counter()` around the `parse()` call in `run_spread()` (:147-223); add a `**Wall clock:**` bullet to the markdown output and print duration per spread in `main()`. (No tests — needs a real key.)

## Phase 2 — Streaming port + adapters (TTFT logging lands here)

Tests first — extend `tests/llm/test_adapter.py` with `_FakeStream`/`_FakeStreamManager` fakes:
- Deltas are decoded suffixes (snapshot `'{"reading": "The Fool'` → `'{"reading": "The Fool steps\\nout"'` yields `"The Fool"` then `" steps\nout"` with a real newline); joined deltas == final `parsed.reading`.
- `StreamDone` carries model + usage; **assert `stream_options={"include_usage": True}` kwarg** (pins the undercharge gotcha).
- Semaphore released after success and mid-stream error; saturated → `LLMBusyError`; `APITimeoutError`/`RateLimitError`/`LengthFinishReasonError` during iteration map to the same domain errors; empty final parse → `LLMResponseError`.
- Mock adapter: joined deltas == `generate_interpretation().reading`, terminal `StreamDone`.

Changes:
4. `pyproject.toml` — add explicit `jiter` dep (currently only transitive via openai; we import it directly).
5. `src/llm/schemas.py` — frozen `StreamTextDelta(text: str)`, `StreamDone(response: InterpretationResponse)`, alias `InterpretationStreamEvent = StreamTextDelta | StreamDone`.
6. `src/llm/port.py` — abstract `def stream_interpretation(self, request) -> AsyncIterator[InterpretationStreamEvent]` (plain `def` returning `AsyncIterator` so impls can be async generator functions).
7. `src/llm/mock_adapter.py` — yield the deterministic narrative in ~3 chunks then `StreamDone` (model="mock", zero usage).
8. `src/llm/openai_adapter.py`:
   - Extract `_prepare_call(request)` (prompts + clamped cap + clamp warning, :67-90) and `_acquire_slot()` (:92-99); refactor the non-streaming path onto them (behavior unchanged).
   - Extract error mapping into module-level `_map_openai_error(exc) -> LLMError` — ordered isinstance checks, **timeout before connection** (preserve the comment at :151-152), incl. the `LengthFinishReasonError` wasted-spend warning.
   - New `async def stream_interpretation()` async generator: prepare → acquire → `async with self._client.chat.completions.stream(..., stream_options={"include_usage": True}, response_format=LeanReading)`: iterate; on `content.delta`, `_narrative_from_snapshot(event.snapshot)`, if longer than emitted: log TTFT on first emission, yield suffix. Then `await stream.get_final_completion()`; empty parse → `LLMResponseError`; emit the existing "openai call completed" info log **plus `ttft_s`**; yield `StreamDone`. Wrap in `except OpenAIError → _map_openai_error` + mirrored failure warning with `duration_s`; `finally: self._semaphore.release()` (also covers `GeneratorExit`).
   - Module helper `_narrative_from_snapshot(snapshot: str) -> str`: `jiter.from_json(snapshot.encode(), partial_mode="trailing-strings")` in try/except ValueError → `""`; return `parsed.get("reading", "")` if str else `""`; comment the SDK `partial_mode=True` gotcha.

## Phase 3 — Service, dependencies, router SSE

Tests first:
- New `tests/interpretations/test_service.py` with fake port adapters (`FakeStreamingAdapter`, `FailingStreamAdapter`, `GatedStreamAdapter` gated on an `asyncio.Event`); optional `stream_service_factory` fixture in `tests/conftest.py` mirroring `generate_handler_factory` (:114-136). Cases: happy path (frames delta…→done, doc persisted, usage settled); existing → single done, no charge; not-found/deleted-user/exhausted-budget raise **before** any frame; mid-stream failure → `event: error`, reservation released, nothing persisted; heartbeats (tiny `sse_heartbeat_seconds`, gated adapter → `reasoning` frames first); disconnect (`gen.aclose()` after one delta, release gate, poll mock_db until doc + settled usage appear).
- Extend `tests/interpretations/test_router.py`: `_collect_sse` helper via `client.stream("POST", ..., headers={"Accept": "text/event-stream"})`; content-type; deltas join to the mock narrative; done payload matches `GET /readings/{id}`; idempotent second stream = single done; 404/402/401 with SSE Accept still return JSON error bodies with real statuses; default-Accept behavior unchanged (existing tests untouched).

Changes:
9. `src/core/config.py` — `sse_heartbeat_seconds: float = 5.0`.
10. `src/interpretations/schemas.py` — `StreamReasoningEvent(AppSchema)` (`elapsed_s: float`), `StreamErrorEvent(AppSchema)` (`detail: str`, `status_code: int`); `done` reuses `GeneratedInterpretationResponse`.
11. `src/interpretations/service.py` (currently a stub) — the core:
    - Module fn `build_llm_request(reading: dict) -> InterpretationRequest` (extracted verbatim from handler :96-111); `_sse(event, data) -> str` (`f"event: {e}\ndata: {d}\n\n"`, data always `model_dump_json()`); module-level `_BACKGROUND_TASKS: set[asyncio.Task]`.
    - `InterpretationStreamService` (same six deps as `GenerateInterpretationHandler`).
    - `start_stream(reading_id, user_id) -> AsyncIterator[str]` (eager): `asyncio.gather` of the three lookups (same as handler :64-68); `ReadingNotFoundError`/`UnauthorizedError`; budget resolution incl. explicit-zero rule (:81-83); existing → `_stored_stream` (one done frame); else `worst_case_cost_usd`, eager `reserve_usage` (False → `BudgetExceededError`, commented deviation from `reserve_budget`); `asyncio.Queue`; `create_task(self._generate_and_persist(...))` registered in `_BACKGROUND_TASKS`; return `self._event_stream(queue, task)`.
    - `_generate_and_persist`: consume `stream_interpretation`; deltas → queue; `StreamDone` → `cost_usd`, build `Interpretation` + `InterpretationUsage` (reuse handler logic :128-140), `upsert_by_reading_id`, `settle_usage`, enqueue done; `except Exception` → `release_usage`, warn, enqueue error. Always terminates the queue; never raises out.
    - `_event_stream(queue, task)`: `wait_for(queue.get(), timeout=settings.sse_heartbeat_seconds)`; timeout → `reasoning` before first delta, `: keep-alive` after; break on done/error; `finally`: on early consumer close, log "client disconnected — generation continues", do NOT cancel the task.
12. `src/core/dependencies.py` — `get_interpretation_stream_service` factory + `InterpretationStreamServiceDep` alias (no import cycle: service.py never imports dependencies.py).
13. `src/interpretations/router.py` — add `request: Request` + the service dep; `if "text/event-stream" in request.headers.get("accept", "")` → `StreamingResponse(await service.start_stream(...), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})`; else existing mediator call unchanged. Docstring documents the event vocabulary. (Content negotiation, not business logic — router stays thin; `response_model` stays, FastAPI skips validation for Response instances.)
14. `src/interpretations/commands/generate_interpretation.py` — replace :96-111 with `build_llm_request(reading)` from service.py (no cycle). Nothing else. No `main.py` change (no new command/handler).

## Phase 4 — Docs + verification

- Update `docs/interpretations/usage-and-budget-flow.md`: streaming path (eager reserve → task-owned settle/release, disconnect-completes, error-event mapping). No prompt changes → `make prompt-doc` untouched.
- `make test`, `make lint` green. `uv sync` after the pyproject change.
- Manual check with real key: `make dev`; auth token; create reading; then
  `curl -N -X POST -H "Authorization: Bearer $TOKEN" -H "Accept: text/event-stream" http://localhost:8000/api/v1/readings/$RID/interpretation`
  Expect `reasoning` events ~every 5s, then `delta` chunks arriving **incrementally** (this validates BaseHTTPMiddleware doesn't buffer), then `done` with non-zero usage. Logs: access line has `duration_ms` + `request_id`; "openai call completed" has `request_id`, `ttft_s`, `duration_s`, non-zero tokens. Repeat curl → single done. No-Accept curl → unchanged JSON. Kill curl mid-stream → doc still lands in Mongo, "client disconnected" log fires.

## Risks / accepted tradeoffs

- **BaseHTTPMiddleware + StreamingResponse**: modern Starlette passes chunks through unbuffered, but eyeball it in the manual curl; fallback is converting `RequestIDMiddleware` to pure-ASGI like `AccessLogMiddleware`.
- **`LLMBusyError` after headers**: semaphore is acquired inside the adapter generator (post-headers) → busy surfaces as an `error` event, not HTTP 503. Accepted.
- **Shutdown**: an in-flight background generation at SIGTERM may not release its reservation — same worst case as today's killed in-flight request. Noted, not solved.
- **Concurrent stream + JSON generate**: unchanged last-write-wins posture (upsert + budget gate).
- Follow-ups (out of scope): streaming for superadmin `/api/v1/llm/interpret`; `ttft_s` on the `done` payload; reasoning-effort/model A/B via the harness if 30s total is still too long.
