# Email Service (Resend) + Password Reset — Design

**Date:** 2026-09-14
**Status:** Approved design, pending implementation plan

## Goal

Ship the password-reset flow specified in
[`docs/auth/password-reset-flow.md`](../../auth/password-reset-flow.md) and, in the same
effort, add a production email adapter backed by Resend so the flow actually delivers
email on `tarotdivinations.com`.

## Relationship to the existing plan

`docs/auth/password-reset-flow.md` is a complete, previously-confirmed implementation
plan for the reset flow itself: the `src/notifications/` port/adapter package
(`EmailPort`, `ConsoleEmailAdapter`, `MockEmailAdapter`), the two auth commands, the
token/throttle repositories, the two endpoints, enumeration-safe responses, sha256-at-rest
tokens, and session revocation. **That document remains the source of truth for the base
flow and is executed verbatim**, with the deltas below. This spec only designs what is new.

### Deltas to the existing plan

1. **Migration number**: `011_password_reset_tokens_indexes.py` — 008–010 are taken
   (the doc's status note anticipated this; its "NNN = next free" rule applies).
2. **Real provider is now in scope**: the doc explicitly deferred a real provider; this
   effort adds one (Resend). Nothing else in the doc changes.
3. **`RequestPasswordResetHandler` step 7 gains error handling** (see "Send-failure
   policy" below).

## Prerequisites (done)

- Resend account with `tarotdivinations.com` verified (DKIM + return-path records in
  Cloudflare DNS, DNS-only).
- `RESEND_API_KEY` available.
- `resend>=2.44.0` already in `pyproject.toml`; v2.44.0 has native async
  (`resend.Emails.send_async`) — no new dependencies.

## New components

### `src/notifications/errors.py`

```python
class EmailDeliveryError(AppError):  # 502, detail "Email delivery failed"
```

Single error type for the port boundary — mirrors how `src/llm/errors.py` keeps SDK
exceptions from leaking past `LLMPort`. One class (not a hierarchy): no caller
distinguishes failure kinds; they are distinguished in logs only.

### `src/notifications/templates.py`

Plain functions, no template engine:

```python
def password_reset_subject() -> str: ...
def password_reset_text(reset_link: str) -> str: ...
def password_reset_html(reset_link: str) -> str: ...
```

- Subject: `"Reset your Tarot Divinations password"`.
- Text part: two short sentences + raw link + expiry note ("this link expires in
  30 minutes" — wording only; the authoritative TTL stays in config).
- HTML part: minimal single-column body — heading, one line of copy, button-styled
  anchor, raw URL fallback line, expiry note. Inline styles only, no external assets.

### `src/notifications/resend_adapter.py`

```python
class ResendEmailAdapter(EmailPort):
    def __init__(self, api_key: str, from_address: str) -> None: ...
    async def send_password_reset(self, to: str, reset_link: str) -> None: ...
    async def close(self) -> None: ...
```

- Constructor sets `resend.api_key = api_key` and stores `from_address`.
- `send_password_reset` builds the payload from `templates.py` (`from`, `to`, `subject`,
  `text`, `html`) and awaits `resend.Emails.send_async(params)`.
- Exception mapping — **every** failure path becomes `EmailDeliveryError`:
  - `resend.exceptions.ResendError` (covers `RateLimitError`, `ValidationError`,
    `InvalidApiKeyError`, `ApplicationError`, …) → `EmailDeliveryError`, logged with
    the SDK class name.
  - `resend.exceptions.NoContentError` (bare `Exception` subclass, NOT under
    `ResendError`) → `EmailDeliveryError`.
  - Any other `Exception` from the SDK/transport layer (the sync/async HTTP clients
    raise their own errors) → `EmailDeliveryError`. Broad catch is deliberate: the port
    contract is "raises `EmailDeliveryError` or succeeds".
- Logs one `info` line on success (`to` domain only or full address — full address is
  fine; these are our own users and logs are internal) with the Resend message id from
  the response; one `warning` on failure with error class + detail.
- `close()` — no client instance to dispose (module-level SDK); implemented as a no-op
  with `return None`, kept to satisfy the port contract.

### Send-failure policy (decision)

`RequestPasswordResetHandler` wraps step 7 (`email.send_password_reset(...)`) in
`try/except EmailDeliveryError`: log at `error` level (with the throttle/token work
already done), swallow, return normally → endpoint still answers 200.

Rationale: unknown emails never reach the send call, so surfacing a 5xx would fire only
for **existing** accounts and turn any Resend outage into an account-enumeration oracle.
Failures remain visible in structlog and the Resend dashboard. The adapter itself stays
honest and always raises; the enumeration-safety policy lives only in the handler, which
is the component that owns that concern.

`ConfirmPasswordResetHandler` sends no email — no change.

## Config (`src/core/config.py`)

```python
# Email (Resend)
resend_api_key: str = ""
email_from: str = "Tarot Divinations <noreply@tarotdivinations.com>"
```

Plus the settings already specified in the base doc (`frontend_base_url`,
`password_reset_token_ttl_minutes`, `password_reset_rate_limit_window_seconds`,
`password_reset_rate_limit_max_attempts`).

## Wiring (`src/main.py` lifespan)

Mirror the LLM adapter block exactly:

```python
if settings.resend_api_key:
    email_adapter: EmailPort = ResendEmailAdapter(
        api_key=settings.resend_api_key, from_address=settings.email_from
    )
    logger.info("email adapter initialised", adapter="resend")
else:
    email_adapter = ConsoleEmailAdapter()
    logger.info("email adapter initialised", adapter="console")
app.state.email = email_adapter
```

`await email_adapter.close()` on shutdown alongside `llm_adapter.close()`. Everything
else (mediator signature change, `EmailDep`, `tests/conftest.py` mock wiring) is as the
base doc specifies.

## Testing

- **All tests from the base doc, unchanged** — they exercise the flow against
  `MockEmailAdapter`.
- **`tests/notifications/test_resend_adapter.py`** (new, unit-level):
  - success: stub `resend.Emails.send_async`, assert payload has correct `from`/`to`/
    `subject` and both `text` and `html` containing the reset link
  - each mapped failure: `ResendError` subclass, `NoContentError`, and a generic
    `Exception` from the stub → all raise `EmailDeliveryError`
- **Handler-level addition** (in `tests/auth/test_password_reset_commands.py`): a
  failing email port (raises `EmailDeliveryError`) → handler completes without raising,
  token document still stored.
- No live-API tests in the suite. Real delivery verified manually once: `make dev` with
  `RESEND_API_KEY` set, run the forgot-password flow against a real inbox, check DKIM
  pass and spam placement.

## Out of scope

- Welcome / email-verification emails (future port methods)
- Resend webhooks (bounce/complaint tracking)
- React Email or any template engine
- Per-IP throttling (the throttle repo's generic `key` already allows it later)
- Docker/compose env plumbing beyond documenting `RESEND_API_KEY` in `.env`

## Build order

1. Base doc items 1–3 (constants, migration **011**, `src/notifications/` port + console
   + mock adapters)
2. `src/notifications/errors.py`, `templates.py`, `resend_adapter.py` (+ adapter tests)
3. Base doc items 4–13 (config incl. Resend settings, repos, errors, schemas, commands
   with the send-failure try/except, router, deps, main wiring incl. adapter selection,
   conftest, flow tests)
4. Verification: `make lint`, `make test`, manual console-adapter flow via `make dev`,
   then one real-delivery check with the API key
