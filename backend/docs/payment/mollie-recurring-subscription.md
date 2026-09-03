# Mollie Recurring Subscription (€12 / month)

## Context

The API has no payment code today: `User.credits` and `User.stripe_customer_id` are stored but never
written, and CLAUDE.md's "credit-based access, Stripe payments" line is aspirational. The product
needs one €12/month subscription that gates reading/interpretation creation.

**Backend vs Next.js** — settled by Mollie's design: webhooks carry only `id=tr_xxx` with no
signature, so the receiver **must** re-fetch the resource with the secret API key. All state and
Mollie calls live in this Python backend. Next.js only (a) calls `POST /billing/checkout` and
redirects the browser to the returned `checkout_url`, and (b) on the return page polls
`GET /billing/subscription` (Mollie's redirect carries no status).

Decisions confirmed with the user:
- First checkout charges **€12** (`sequenceType: "first"`); on `paid` the backend creates the Mollie
  subscription with `startDate = paidAt + 1 month` → no double charge.
- Registration unchanged (returns tokens). Unpaid accounts exist; **POST /readings** and
  **POST /interpretations/generate** return **402** until active. **Superadmins bypass** the gate.
- Official SDK **`mollie-api-py`** (httpx, `*_async` methods) behind a `PaymentPort`.
- "Update payment method" = new `sequenceType: "first"` checkout for **€0.00** (card + PayPal
  only; iDEAL needs ≥ €0.01 — setting `mollie_mandate_update_amount` lets that change later) →
  new mandate → update subscription `mandateId` → revoke old mandate.
- Confirmation emails via a new `EmailPort` + console adapter only; it is the port
  `docs/auth/password-reset-flow.md` plans, built here first so that work reuses it.
- **Webhook errors split retryable vs terminal**: provider/transient errors return 5xx so
  Mollie retries; only terminal outcomes return 200 (see router table).
- A stale second "first" payment paid after the subscription exists is **auto-refunded**
  (new `refund_payment` on the port) with a warning log — never a silent skip.
- Failed first checkout surfaces as **computed status `checkout_failed`** (doc in
  `pending_checkout` with `pending_checkout_payment_id` cleared); the FE polls until
  status leaves `pending_checkout`.
- **No grace period**: access ends at `current_period_end`; a successful Mollie retry
  restores it instantly via the renewal webhook.
- Silent Mollie-side cancels (mandate revoked at the bank — no renewal webhook) caught by
  **verify-on-stale-read** in `GET /billing/subscription`.
- Emails are **best-effort** — an email failure never changes a webhook response or API
  result.

## Mollie flow (reference)

1. `customers.create` → `cust_x` (stored on our `subscriptions` doc, **not** on `User` — avoids auth
   domain/schema churn; `mollie_customer_id` left as dead field).
2. `payments.create {customerId, sequenceType:"first", amount 12.00 EUR, redirectUrl, webhookUrl,
   metadata{user_id,purpose}}` → `checkout_url`.
3. Webhook `POST id=tr_x` → `payments.get` → if `paid`: mandate exists → `subscriptions.create
   {amount, interval:"1 month", startDate, webhookUrl, mandateId, metadata}`.
4. Monthly: Mollie creates a payment, webhook fires with `id=tr_y`; fetched payment carries
   `subscriptionId`. Failed renewals are retried by Mollie; repeated failures auto-cancel.
5. Webhook must answer 200 in 15 s; retried 10× over 26 h → handler idempotent, 200 for unknown ids.

## New packages

### `src/payments/` (port/adapter, mirrors `src/llm/`)
- `port.py` — `PaymentPort(ABC)`: `create_customer(email, name) -> str`;
  `create_first_payment(customer_id, amount, description, redirect_url, webhook_url, metadata) -> CheckoutSession`;
  `get_payment(id) -> PaymentDetails`; `list_valid_mandates(customer_id) -> list[str]`;
  `create_subscription(customer_id, mandate_id, amount, interval, description, start_date, webhook_url, metadata) -> SubscriptionDetails`;
  `get_subscription(customer_id, id) -> SubscriptionDetails`; `update_subscription_mandate(...)`;
  `cancel_subscription(...) -> SubscriptionDetails`; `revoke_mandate(...)`;
  `refund_payment(payment_id, amount, description) -> None`; `close()`.
- `schemas.py` — `CheckoutSession{payment_id, checkout_url}`, `PaymentDetails{id, status, amount,
  customer_id, subscription_id?, mandate_id?, sequence_type, paid_at?, metadata,
  amount_refunded?, amount_charged_back?}`,
  `SubscriptionDetails{id, status, next_payment_date?}` (plain `BaseModel`, infra types).
- `errors.py` — `PaymentProviderError(502)`, `PaymentProviderConnectionError(502)`,
  `PaymentNotFoundError(404)` (pattern: `src/llm/errors.py`). The first two (plus
  `MandateNotFoundError`) are **retryable** for the webhook route — they must reach
  Mollie as 5xx, not be swallowed by the AppError→200 policy.
- `mollie_adapter.py` — `MollieAdapter(client)`; client injected (like `OpenAIAdapter`); every SDK
  exception re-raised as a domain error. Verify exact SDK resource names (`customers`, `payments`,
  `mandates`, `subscriptions`, `*_async`) against the installed version at implementation time.
- `mock_adapter.py` — `MockPaymentAdapter`: in-memory state, `calls` log, helpers
  `set_payment_status(id, status, mandate_id=..., paid_at=...)` and
  `simulate_subscription_payment(sub_id, status) -> payment_id` for renewal tests.

### `src/notifications/` (compatible with password-reset doc)
- `port.py` — `EmailPort(ABC)`: `send_password_reset(to, reset_link)` (declared for that doc),
  `send_subscription_started(to, period_end)`, `send_subscription_renewed(to, period_end)`,
  `send_subscription_payment_failed(to, update_url)`, `close()`.
- `console_adapter.py` — structlog `logger.info("email", kind=..., to=..., ...)`.
- `mock_adapter.py` — `MockEmailAdapter.sent: list[dict]` (+ `sent_password_resets` view).

### `src/billing/` (domain, CLAUDE.md layout)
- `models.py` — `SubscriptionStatus`: `pending_checkout | active | past_due | canceled`
  (`expired` and `checkout_failed` are computed, not stored). `PaymentPurpose`: `initial | renewal | mandate_update`.
  `Subscription{user_id, mollie_customer_id, mollie_subscription_id?, mandate_id?, status,
  current_period_end?, pending_checkout_payment_id?, canceled_at?, created_at, updated_at}`.
  `Payment{mollie_payment_id, user_id, subscription_id, mollie_subscription_id?, amount, currency,
  status, purpose, paid_at?, processed_status?, created_at, updated_at}`.
- `repository.py` — `SubscriptionWriteRepository` (`upsert_for_user`, `set_pending_checkout`,
  `activate`, `set_status`, `extend_period`, `set_mandate`), `SubscriptionReadRepository`
  (`find_by_user_id`, `find_by_mollie_subscription_id`, `find_by_mollie_customer_id`),
  `PaymentWriteRepository` (`record_pending`, `claim_status(id, status, snapshot) -> prev | None`
  = atomic upsert `find_one_and_update({"mollie_payment_id": id, "processed_status": {"$ne": status}})`,
  `reset_processed_status`), `PaymentReadRepository`.
- `service.py` — errors: `SubscriptionAlreadyActiveError(409)`, `NoSubscriptionError(404)`,
  `SubscriptionNotActiveError(409)`, `MandateNotFoundError(502)`; helper `add_one_month(dt)`
  (day-clamped, no dateutil).
- `schemas.py` — `CheckoutResponse{checkout_url}`, `SubscriptionReadModel`/`SubscriptionResponse`
  `{status, has_active_access, current_period_end?, mollie_subscription_id?, ...}` where
  `status` may also be `"none"` (no doc) or `"checkout_failed"` (doc in `pending_checkout`
  with `pending_checkout_payment_id` cleared) — **FE poll contract: poll until status
  leaves `pending_checkout`**; `checkout_failed` means show "payment failed, try again"
  and re-offer checkout, `CancelResponse`.
- `commands/` — `start_subscription_checkout.py`, `start_mandate_update_checkout.py`,
  `cancel_subscription.py`, `process_payment_webhook.py`. `queries/get_subscription_by_user_id.py`.
- `router.py` (`prefix="/billing"`):

| Method | Path | Auth | Result |
|---|---|---|---|
| POST | `/billing/checkout` | `CurrentUser` | 201 `CheckoutResponse` |
| GET | `/billing/subscription` | `CurrentUserId` | 200 `SubscriptionResponse` (`status:"none"` if absent) |
| POST | `/billing/payment-method/checkout` | `CurrentUser` | 201 `CheckoutResponse` (€0.00) |
| POST | `/billing/cancel` | `CurrentUserId` | 200 `CancelResponse` |
| POST | `/billing/webhooks/mollie` | none, `id: Form()` | 200 for terminal errors (`PaymentNotFoundError`, validation — logged); **retryable** errors (`PaymentProviderError`, `PaymentProviderConnectionError`, `MandateNotFoundError`) and unexpected exceptions → 5xx so Mollie retries |

## Handler logic

- **StartSubscriptionCheckout**: 409 if status ∈ {active, past_due} or canceled with future
  period_end (reactivation is a follow-up). Reuse `mollie_customer_id` if doc exists else
  `create_customer`. Upsert doc `pending_checkout`; `create_first_payment(amount=12.00,
  redirect_url=f"{frontend_base_url}{frontend_billing_return_path}", webhook_url=
  f"{public_base_url}/api/v1/billing/webhooks/mollie", metadata={user_id, purpose:"initial"})`;
  `record_pending`; return `checkout_url`.
- **StartMandateUpdateCheckout**: requires active/past_due; same with `amount=
  mollie_mandate_update_amount`, purpose `mandate_update`.
- **CancelSubscription**: requires `mollie_subscription_id` and active/past_due;
  `cancel_subscription`; `set_status(canceled, canceled_at)`; `current_period_end` untouched.
- **GetSubscriptionByUserId**: `has_active_access` = `active`, or `canceled|past_due`
  with `current_period_end > now` (all datetimes tz-aware UTC end to end; **no grace
  period** — a successful Mollie retry restores access via the renewal webhook). Status
  reads `checkout_failed` when the doc is `pending_checkout` with
  `pending_checkout_payment_id` cleared. **Verify-on-stale-read**: if `active|past_due`
  and `current_period_end` is more than `subscription_verify_stale_after_hours` past,
  `get_subscription` from Mollie once and sync status — catches a mandate revoked at
  the bank, where no renewal webhook fires; on Mollie error serve the stored doc.
- **ProcessPaymentWebhook**:
  1. `get_payment(id)`; `PaymentNotFoundError` → log, return.
  2. `claim_status(id, details.status, snapshot)`; `None` → already processed → return. Purpose:
     `subscription_id` present → `renewal`, else `metadata.purpose`.
  3. Find subscription by `mollie_subscription_id`, else `mollie_customer_id`, else `metadata.user_id`.
  4. Dispatch `(purpose, status)`:
     - `initial, paid`: if `mollie_subscription_id` already set (a stale second checkout
       paid late — user double-charged) → **`refund_payment` the stray payment** +
       warning log, done; never a silent skip. Else mandate = `details.mandate_id` or
       first of `list_valid_mandates`; none → `MandateNotFoundError` (5xx → Mollie
       retries); `create_subscription(start_date=add_one_month(paid_at))`;
       `activate(period_end = subscription.next_payment_date or start_date)` — Mollie's
       date is authoritative, `add_one_month` is the fallback; email
       `subscription_started`. On failure after claim → `reset_processed_status` so the
       retry re-runs (works because provider errors return 5xx per the router policy).
     - `initial|mandate_update, failed|expired|canceled`: clear `pending_checkout_payment_id`
       (this is what makes the computed `checkout_failed` status appear to the FE poll).
     - `renewal, paid`: `extend_period` — prefer Mollie's `next_payment_date` (via
       `get_subscription`) over `add_one_month(paid_at)` so month-end clamping never
       drifts from Mollie's schedule; status active, email `renewed`.
     - `renewal, failed|expired|canceled`: status `past_due`, email `payment_failed`; then
       `get_subscription` — if Mollie reports `canceled` → status canceled.
     - `mandate_update, paid`: guard — if the subscription is no longer `active|past_due`
       (canceled between checkout and webhook), best-effort `revoke_mandate(new)` + log,
       done. Else `update_subscription_mandate(new)`; `set_mandate`; best-effort
       `revoke_mandate(old)`.
     - `open|pending`: snapshot only.
  5. **Emails are best-effort**: each send wrapped in try/except + log — an email failure
     never changes the webhook response (a retried webhook is already claimed and would
     skip the email anyway, so failing would only lose the state change too).
  6. **Refund/chargeback awareness**: snapshot `amount_refunded` / `amount_charged_back`
     from the fetched payment and log a warning when nonzero. Acting on chargebacks
     (→ past_due/canceled) is a documented known gap — visible in logs, not silent.

State machine:
```
(none) → pending_checkout → active ⇄ past_due → canceled → [expired: computed when period_end < now]
active → canceled (POST /cancel; access until period_end)
pending_checkout → [checkout_failed: computed when pending_checkout_payment_id cleared] → new checkout
```

## Frontend contract (basis for the FE-specific spec)

Everything the FE needs, in one place:

1. **Subscribe**: `POST /api/v1/billing/checkout` (Bearer) → `{checkout_url}` → redirect the
   browser there. 409 = already subscribed (or canceled with time left) — show manage UI
   instead.
2. **Return page**: Mollie's redirect carries **no status**. Poll
   `GET /api/v1/billing/subscription` until `status` leaves `pending_checkout`:
   - `active` → success, show `current_period_end`
   - `checkout_failed` → "payment failed, try again" + re-offer checkout (a new
     `POST /billing/checkout` is allowed from this state)
   - poll interval ~2s with a timeout fallback (webhooks normally land in seconds)
3. **Statuses** the read model can return: `none | pending_checkout | checkout_failed |
   active | past_due | canceled | expired` plus `has_active_access: bool` — **gate UI on
   `has_active_access`, not on status** (canceled/past_due users may retain access until
   `current_period_end`; no grace period beyond it).
4. **Gated endpoints**: `POST /readings` and `POST /interpretations/generate` return
   **402** without active access — render as "subscription required" with a checkout CTA,
   not a generic error. GET/list/save stay open (lapsed users keep their history).
5. **Update payment method**: `POST /api/v1/billing/payment-method/checkout` → same
   redirect + poll shape (€0.00 authorisation; card/PayPal only). Requires active/past_due.
6. **Cancel**: `POST /api/v1/billing/cancel` → `{status: "canceled", current_period_end}`
   — communicate "access until <date>", no refund.
7. **Failure UX inputs**: `past_due` → show "payment failed, update your payment method"
   (Mollie retries automatically; access already reflects `has_active_access`).

## Core changes
- `src/core/exceptions.py`: `PaymentRequiredError(AppError)` 402, "Active subscription required".
- `src/core/config.py`: `mollie_api_key=""`, `public_base_url="http://localhost:8000"`,
  `frontend_base_url="http://localhost:3000"`, `frontend_billing_return_path="/billing/return"`,
  `subscription_amount="12.00"`, `subscription_currency="EUR"`, `subscription_description=
  "Gnosis Esoterica monthly subscription"`, `mollie_mandate_update_amount="0.00"`,
  `subscription_verify_stale_after_hours=24`, dev-only `subscription_start_offset_days=30`
  (`0` → first renewal fires immediately in test mode). **Fail fast**: `app_env ==
  "production"` with an empty or `test_` `mollie_api_key` refuses to start — the mock
  payment adapter must be unreachable in production (same class of issue as the
  hardcoded `jwt_secret_key` default).
- `.env.example`: add the above (also fix stale JWT/OpenAI keys while there); note ngrok for webhooks.
- `src/core/dependencies.py`: `get_payments`/`PaymentsDep`, `get_email`/`EmailDep` (copy `get_llm`
  pattern, `app.state.payments` / `app.state.email`); `get_active_subscription(user: CurrentUser,
  mediator)` → returns early if `user.is_superadmin`, else queries and raises
  `PaymentRequiredError`; alias `RequireActiveSubscription`.
- `src/main.py`: `_wire_mediator(mediator, llm, payments, email, db)` registers 4 commands + 1
  query; lifespan builds `MollieAdapter` if `settings.mollie_api_key` else `MockPaymentAdapter`,
  plus `ConsoleEmailAdapter`; sets `app.state.payments/email`; closes both on shutdown; mounts
  `billing_router` at `/api/v1`.
- Gate: add `_sub: RequireActiveSubscription` param to `create_reading`
  (`src/readings/router.py:23`) and `generate_interpretation` (`src/interpretations/router.py:25`)
  only — GET/list/tags/save stay open so lapsed users keep their history.
- `src/database/collections/constants.py`: `SUBSCRIPTIONS_COLLECTION`, `PAYMENTS_COLLECTION`.
- `src/migrations/versions/008_billing_indexes.py`: subscriptions — unique `user_id`, sparse unique
  `mollie_subscription_id`, `mollie_customer_id`; payments — unique `mollie_payment_id`,
  `(user_id, created_at desc)`, `subscription_id`.
- `pyproject.toml`: add `mollie-api-py` and `python-multipart` (for `Form()`) to runtime deps via `uv add`.

## Tests
- `tests/conftest.py`: `app` fixture wires `MockPaymentAdapter`/`MockEmailAdapter` through
  `_wire_mediator` and `app.state`; fixtures `mock_payments`, `mock_email`, `subscribed_token`
  (register + insert active subscription doc directly into `mock_db`). Switch existing tests that
  POST `/readings` or `/interpretations/generate` to `subscribed_token`.
- `tests/billing/test_commands.py`: checkout creates customer once; 409 when active; webhook
  initial paid → subscription with `start_date = paid_at + 1 month`, active, 1 email; same webhook
  twice → 1 subscription, 1 email; unknown id no-op; renewal paid extends; renewal failed →
  past_due + email; mandate_update paid → update + revoke recorded; cancel; `add_one_month`
  clamping (Jan 31 → Feb 28/29); stray second initial paid → refund recorded, no second
  subscription; mandate_update paid after cancel → new mandate revoked, no update; email
  adapter raising → state change still persists, webhook succeeds.
- `tests/billing/test_queries.py`: `has_active_access` matrix.
- `tests/billing/test_router.py`: checkout 201; subscription `none` → active after webhook; webhook
  bogus id → 200; provider error during webhook → 5xx (Mollie retries), then retry succeeds;
  failed first payment → subscription reads `checkout_failed` (poll terminates); stale
  active doc + Mollie reports canceled → GET syncs to canceled; concurrent duplicate
  webhook (`asyncio.gather`) → one subscription; gate: 402 with `auth_token`, 201 with
  `subscribed_token`, 201 for superadmin without subscription.
- `tests/payments/test_mollie_adapter.py`: `MagicMock` client with `AsyncMock` `*_async` methods;
  asserts payload (amount dict, `sequenceType`, `interval`, ISO `startDate`); SDK error → 502.

## Docs
- New `docs/mollie-subscriptions.md`: flow, state machine, endpoint table, webhook idempotency
  contract, frontend contract (redirect + poll), dev setup (`ngrok http 8000`, `PUBLIC_BASE_URL`,
  Mollie `test_` key, test-mode checkout picks paid/failed), known gaps (reactivate after cancel,
  no expiry cron, iDEAL excluded from mandate update, chargebacks logged but not acted on,
  no receipt/VAT invoicing in emails — EU B2C likely requires one eventually, no rate
  limiting on the webhook/checkout endpoints, no account-deletion/GDPR flow — when that
  feature lands it must cancel the subscription, revoke the mandate and delete the
  Mollie customer).
- `CLAUDE.md`: overview → "subscription-based access (Mollie)"; add `src/payments/`,
  `src/notifications/`, `src/billing/` to Key Files.
- `docs/database/model_references.md`: replace Stripe `transactions`/`credit_ledger` with
  `subscriptions`/`payments`; mark `stripe_customer_id` deprecated.
- `docs/auth/password-reset-flow.md`: bump its migration to `009`; note `EmailPort` now exists.

## Sequencing
1. deps + settings + `PaymentRequiredError`
2. `src/notifications/`, `src/payments/` + adapter tests
3. constants + migration 008
4. `src/billing/` models/repos/schemas/service
5. handlers + `_wire_mediator`/lifespan/conftest (suite green again)
6. router + webhook + gate + migrate affected tests
7. billing tests, docs

## Local test environment (three layers)
1. **Automated tests** — `MockPaymentAdapter`/`MockEmailAdapter` only; webhook driven by posting
   `id=tr_mock_N` after `set_payment_status(...)`; renewals via `simulate_subscription_payment`.
2. **Dev without public URL** — empty `MOLLIE_API_KEY` → mock adapter. Add a dev-only router
   `src/billing/mock_checkout.py` (mounted only when `settings.app_env != "production"` and no key):
   `GET /billing/mock-checkout/{payment_id}` renders a Pay / Fail page; clicking sets the mock
   status, POSTs our own webhook, then redirects to `frontend_base_url + return path`.
   `POST /billing/mock-checkout/{mollie_sub_id}/renew?status=paid|failed` fabricates a renewal.
   `MockPaymentAdapter.create_first_payment` returns `checkout_url = {public_base_url}/api/v1/billing/mock-checkout/{id}`.
3. **Real Mollie test mode** — `test_` API key (no money moves; hosted checkout shows a status
   picker); webhooks need a tunnel: `ngrok http 8000` → `PUBLIC_BASE_URL=https://xxx.ngrok-free.app`
   (Mollie rejects localhost webhook URLs; `redirectUrl` may be localhost:3000). Dashboard →
   Developers → Webhooks lists calls and allows resend (idempotency check). Add dev setting
   `subscription_start_offset_days: int = 30`-style override (`0` makes the first renewal fire
   immediately in test mode). Document all of this in `docs/mollie-subscriptions.md`.

## Verification
- `make test`, `make lint`, `pyright`.
- Manual: `MOLLIE_API_KEY=test_...`, `PUBLIC_BASE_URL=<ngrok>`; register → `POST /billing/checkout`
  → open `checkout_url` → pick "Paid" → webhook arrives → `GET /billing/subscription` shows
  `active`, `current_period_end` one month out; Mollie dashboard shows subscription with matching
  `startDate`. Repeat with "Failed" → stays `pending_checkout`. `POST /billing/cancel` → `canceled`
  in dashboard. Without key: mock adapter, `POST /readings` → 402 until a subscription doc exists.

## Sequence diagrams

### 1. Start subscription (first €12 payment → mandate → subscription)

```
Browser          Next.js           FastAPI                         Mollie
  │  click Subscribe │                 │                              │
  │─────────────────▶│ POST /api/v1/billing/checkout (Bearer JWT)    │
  │                  │────────────────▶│                              │
  │                  │                 │ POST /v2/customers           │
  │                  │                 │   {name, email, metadata:{user_id}}
  │                  │                 │─────────────────────────────▶│
  │                  │                 │◀── {id: "cust_A"} ───────────│   store cust_A on subscriptions doc
  │                  │                 │ POST /v2/payments            │
  │                  │                 │   {customerId:"cust_A", sequenceType:"first",
  │                  │                 │    amount:{EUR,"12.00"}, description,
  │                  │                 │    redirectUrl: FE/billing/return,
  │                  │                 │    webhookUrl:  API/billing/webhooks/mollie,
  │                  │                 │    metadata:{user_id, purpose:"initial"}}
  │                  │                 │─────────────────────────────▶│
  │                  │                 │◀── {id:"tr_1", status:"open", _links.checkout.href}
  │                  │◀── {checkout_url} ──│                          │   store tr_1 as pending payment
  │◀── 302 checkout_url ──│            │                              │
  │  pays on Mollie hosted page ─────────────────────────────────────▶│
  │                  │                 │◀── POST webhook  id=tr_1 ────│   (unsigned; body is only the id)
  │                  │                 │ GET /v2/payments/tr_1 ──────▶│
  │                  │                 │◀── {status:"paid", paidAt, customerId:"cust_A",
  │                  │                 │     mandateId:"mdt_1", metadata:{user_id,purpose}}
  │                  │                 │ POST /v2/customers/cust_A/subscriptions
  │                  │                 │   {amount:{EUR,"12.00"}, interval:"1 month",
  │                  │                 │    startDate: paidAt+1 month, description,
  │                  │                 │    mandateId:"mdt_1", webhookUrl, metadata:{user_id}}
  │                  │                 │─────────────────────────────▶│
  │                  │                 │◀── {id:"sub_1", status:"active", nextPaymentDate}
  │                  │                 │── 200 OK ───────────────────▶│   status=active, period_end=startDate, email "started"
  │◀─ redirect to FE/billing/return ──────────────────────────────────│   (redirect carries NO status)
  │                  │ GET /billing/subscription (poll until != pending_checkout)
  │                  │────────────────▶│
  │                  │◀── {status:"active", has_active_access:true, current_period_end}
```

### 2. Monthly renewal (no user or frontend involved)

```
FastAPI                                   Mollie
  │                                         │  on nextPaymentDate: charges mandate, creates
  │                                         │  payment tr_9 with subscriptionId:"sub_1"
  │◀── POST webhook  id=tr_9 ───────────────│
  │ GET /v2/payments/tr_9 ─────────────────▶│
  │◀── {status:"paid"|"failed", paidAt, customerId, subscriptionId:"sub_1", amount, metadata}
  │  lookup our doc by mollie_subscription_id
  │  paid   → period_end = paidAt+1 month, status active, email "renewed"
  │  failed → status past_due, email "payment failed"
  │           (+ GET subscription sub_1 to detect Mollie auto-cancel)
  │── 200 OK ──────────────────────────────▶│
```

### 3. Update payment method (new mandate swapped onto the subscription)

```
Browser/Next.js        FastAPI                                  Mollie
  │ POST /billing/payment-method/checkout                          │
  │──────────────────▶│ POST /v2/payments {customerId:"cust_A", sequenceType:"first",
  │                   │   amount:{EUR,"0.00"}, redirectUrl, webhookUrl,
  │                   │   metadata:{user_id, purpose:"mandate_update"}}
  │                   │───────────────────────────────────────────▶│
  │◀── {checkout_url} │◀── {id:"tr_5", checkout href} ─────────────│
  │ user authorises card/PayPal on Mollie ─────────────────────────▶│
  │                   │◀── POST webhook id=tr_5 ───────────────────│
  │                   │ GET /v2/payments/tr_5 → {status:"paid", mandateId:"mdt_2", metadata.purpose}
  │                   │ PATCH /v2/customers/cust_A/subscriptions/sub_1 {mandateId:"mdt_2"}
  │                   │ DELETE /v2/customers/cust_A/mandates/mdt_1  (revoke old, best-effort)
  │                   │  our doc: mandate_id = mdt_2
  │                   │── 200 OK ─────────────────────────────────▶│
```

### 4. Cancel

```
Next.js            FastAPI                                     Mollie
  │ POST /billing/cancel │ DELETE /v2/customers/cust_A/subscriptions/sub_1
  │─────────────────────▶│────────────────────────────────────────▶│
  │                      │◀── {id:"sub_1", status:"canceled"} ─────│
  │                      │  our doc: status=canceled, canceled_at; current_period_end kept
  │◀── {status:"canceled", current_period_end} ──│                 │   access until period_end
```

### Essential data contract

| Direction | Field | Why it is essential |
|---|---|---|
| us → Mollie | `webhookUrl` (public HTTPS) | Only way we learn payment outcomes; must return 200 in 15 s |
| us → Mollie | `redirectUrl` | Where the browser lands; carries nothing, so FE polls us |
| us → Mollie | `customerId` + `sequenceType:"first"` | Turns a payment into a mandate |
| us → Mollie | `metadata.user_id`, `metadata.purpose` | Echoed back; webhook finds the user and tells initial vs mandate-update apart |
| us → Mollie | `mandateId`, `interval`, `startDate`, `amount` | Defines the recurring charge; `startDate = paidAt + 1 month` prevents double charge |
| Mollie → us | `id` in webhook | The only payload; always re-fetch |
| Mollie → us | payment `status`, `paidAt`, `mandateId`, `subscriptionId`, `customerId`, `metadata` | Everything the state machine needs |
| Mollie → us | subscription `id`, `status`, `nextPaymentDate` | Correlates renewals; period end |
| never shared | JWT, password hash, our `_id`s beyond `metadata.user_id` | Mollie only needs email/name |

## Mongo documents

### `subscriptions` — one per user

```js
{
  _id: ObjectId,
  user_id: "66f...",                    // users._id as str — unique index
  mollie_customer_id: "cust_A",         // index; created once, reused for every checkout
  mollie_subscription_id: "sub_1",      // optional; sparse unique — renewal webhooks look up by this
  mandate_id: "mdt_2",                  // optional; current mandate
  status: "active",                     // pending_checkout | active | past_due | canceled
  current_period_end: ISODate,          // optional; paid-through date
  pending_checkout_payment_id: "tr_5",  // optional; latest open first-payment
  canceled_at: ISODate,                 // optional
  created_at: ISODate,
  updated_at: ISODate
}
```

### `payments` — one per Mollie payment (audit + idempotency)

```js
{
  _id: ObjectId,
  mollie_payment_id: "tr_9",            // unique — the idempotency key
  user_id: "66f...",                    // index (user_id, created_at desc)
  subscription_id: "6701...",           // subscriptions._id as str — index
  mollie_subscription_id: "sub_1",      // optional; renewals only
  purpose: "renewal",                   // initial | renewal | mandate_update
  amount: "12.00",                      // Mollie's string form
  currency: "EUR",
  status: "paid",                       // Mollie raw status: open|pending|paid|failed|expired|canceled
  paid_at: ISODate,                     // optional
  processed_status: "paid",             // last status acted on; claim via find_one_and_update
                                        //   {mollie_payment_id, processed_status: {$ne: new}}
  created_at: ISODate,
  updated_at: ISODate
}
```

`users` is untouched (`credits`, `stripe_customer_id` remain dead fields). Optional fields are
omitted, never `null`.
