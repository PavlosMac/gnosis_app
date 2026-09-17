# Email Service

How the API sends email: the `EmailPort` abstraction in `src/notifications/`, the three
adapters behind it, how one is chosen at startup, and the password-reset flow that is
(so far) its only caller. Design rationale lives in
[`docs/auth/password-reset-flow.md`](../auth/password-reset-flow.md); this doc is the
"how it actually works" reference for the code as built.

## The shape

Email is cross-cutting infrastructure, not a domain: no router, no collection, no CQRS
of its own. It mirrors `src/llm/` exactly — a port, a real adapter, a console fallback,
and a test mock:

| Piece | File | Job |
|---|---|---|
| `EmailPort` | `src/notifications/port.py` | The contract: `send_password_reset(to, reset_link)`, `send_support_request(to, reply_to, subject, message, user_id, submitted_at)` and `close()`. Adapters either succeed or raise `EmailDeliveryError` — nothing else escapes. |
| `ResendEmailAdapter` | `src/notifications/resend_adapter.py` | Real delivery via the Resend SDK (`resend.Emails.send_async`). |
| `ConsoleEmailAdapter` | `src/notifications/console_adapter.py` | Dev fallback — logs the recipient and the raw reset link (or the support message) instead of sending. |
| `MockEmailAdapter` | `src/notifications/mock_adapter.py` | Tests — appends `{to, reset_link}` to `sent_password_resets` so a test can pull the token straight out; support relays land in `sent_support_requests`. |
| `EmailDeliveryError` | `src/notifications/errors.py` | The single error at the port boundary (`AppError`, 502). |
| Templates | `src/notifications/templates.py` | Subject, plain-text and HTML bodies for the reset and support emails. |

## Adapter selection

Chosen once in the lifespan (`src/main.py`), keyed on the presence of
`Settings.resend_api_key` — **not** on environment:

- `RESEND_API_KEY` set → `ResendEmailAdapter(api_key, from_address=Settings.email_from)`.
  Real email goes out, even on a dev machine.
- unset → `ConsoleEmailAdapter`.

The chosen adapter is stored on `app.state.email`, exposed to routers as `EmailDep`
(`src/core/dependencies.py`), and handed to `RequestPasswordResetHandler` through
`_wire_mediator`. Tests never see either real adapter: `tests/conftest.py` builds the app
with a `MockEmailAdapter` and exposes it as the `mock_email` fixture.

## Configuration

| Setting (`src/core/config.py`) | Env var | Default | Notes |
|---|---|---|---|
| `resend_api_key` | `RESEND_API_KEY` | `""` | Empty selects the console adapter. |
| `email_from` | `EMAIL_FROM` | `Tarot Divinations <noreply@tarotdivinations.com>` | Must be on a domain verified in Resend (see [Resend setup](#resend-setup)). |
| `frontend_base_url` | `FRONTEND_BASE_URL` | `http://localhost:3000` | Reset links are `{frontend_base_url}/reset-password?token=…`. |
| `password_reset_token_ttl_minutes` | `PASSWORD_RESET_TOKEN_TTL_MINUTES` | `30` | Token lifetime. The email wording is hardcoded to match — see [Need to know](#need-to-know). |
| `password_reset_rate_limit_window_seconds` | `PASSWORD_RESET_RATE_LIMIT_WINDOW_SECONDS` | `3600` | Throttle window per email. |
| `password_reset_rate_limit_max_attempts` | `PASSWORD_RESET_RATE_LIMIT_MAX_ATTEMPTS` | `5` | Requests allowed per email per window. |
| `support_email` | `SUPPORT_EMAIL` | `""` | Destination inbox for support relays (not the From identity). Empty → the endpoint answers 503. |
| `support_contact_rate_limit_window_seconds` | `SUPPORT_CONTACT_RATE_LIMIT_WINDOW_SECONDS` | `3600` | Throttle window per user. |
| `support_contact_rate_limit_max_attempts` | `SUPPORT_CONTACT_RATE_LIMIT_MAX_ATTEMPTS` | `5` | Support messages allowed per user per window. |

## The password-reset flow, step by step

Two public endpoints under `/api/v1/auth` (`src/auth/router.py`), both thin: the router
builds a command and the handler does everything.

### `POST /auth/forgot-password` — `{email}`

`RequestPasswordResetHandler` (`src/auth/commands/request_password_reset.py`):

1. **Throttle, before anything else.** The throttle key is the email case-folded
   (`strip().lower()`) so `User@x.com` and `user@x.com` share one limit. The attempt is
   **recorded first, then counted** — under a concurrent burst every caller sees every
   other caller's just-inserted attempt, so a race can only over-throttle, never let
   requests through past the cap. Over the limit → `TooManyPasswordResetRequestsError`
   → **429**. This happens for known and unknown emails alike, so the 429 can't be used
   to probe for accounts.
2. **Look up the user.** Unknown email → return silently. The response is identical
   either way: **200** with
   `"If an account exists for this email, a password reset link has been sent."`
3. **Mint the token.** `secrets.token_urlsafe(32)`; only its SHA-256 hex is stored.
   Any earlier unused tokens for the user are deleted first — one live link per user, a
   new request supersedes older ones.
4. **Build the link** — `{frontend_base_url}/reset-password?token=<raw token>` — and
   `send_password_reset(to, reset_link)` on whatever adapter is wired.
5. **Swallow `EmailDeliveryError`.** Only existing accounts ever reach the send, so a
   provider outage that surfaced as 502 would itself be an enumeration oracle. The
   handler logs `password reset email delivery failed` at error level and the endpoint
   still answers 200; the user can retry.

### `POST /auth/reset-password` — `{token, new_password}` (8–128 chars)

`ConfirmPasswordResetHandler` (`src/auth/commands/confirm_password_reset.py`):

1. **Consume the token atomically** — SHA-256 the submitted token,
   `find_one_and_update({token_hash, used: false} → {used: true})`. No match → **400**
   `Invalid or already used reset token`. The lookup deliberately does *not* filter on
   `expires_at`, so an expired-but-unused token still comes back and can be told apart
   from a bad one.
2. **Check expiry** → **410** `Reset link has expired`. (The token has already been
   marked used by step 1; that's fine — an expired token is dead either way.)
3. **Set the new password.** `AuthWriteRepository.update` on `password_hash`. If nothing
   matched — the user was deleted between request and confirm — raise the same 400
   rather than report a success that didn't happen.
4. **Revoke every session** — `RefreshTokenRepository.revoke_all_for_user` deletes all
   refresh-token families for the user, every device. A reset must lock out whoever held
   the old password.
5. **Delete any remaining unused reset tokens** for the user, as defense in depth.

Success → **200** `Password has been reset successfully.`

## The support contact flow

`POST /api/v1/support/contact` — `{subject (3–200), message (10–5000)}`, **auth required**
(`src/support/router.py`). The limits mirror the frontend's `contactSupportSchema`; the
frontend pins them in a test, so change both together.

`ContactSupportHandler` (`src/support/commands/contact_support.py`):

1. **Refuse if `support_email` is empty** → **503** `Support is not available right now`.
2. **Throttle per user**, reusing `PasswordResetThrottleRepository` with key
   `support:<user_id>` (the prefix keeps it apart from the email-keyed reset limit).
   Same record-then-count ordering; over the limit → **429**.
3. **Relay** via `send_support_request(to=support_email, reply_to=user.email, …)`. The
   body is the message verbatim (HTML-escaped in the HTML part) plus a metadata block:
   user email, user id, submission time.

Two deliberate differences from forgot-password:

- **Identity comes from the JWT**, never the body. The router uses `CurrentUser`, so
  `reply_to` and the metadata are always the authenticated account — tickets cannot be
  forged, and extra identity fields in the body are ignored.
- **`EmailDeliveryError` propagates as 502.** There is no enumeration concern here, and
  the user must know the message did not go through.

Why `Reply-To` rather than putting the user in `From`: From stays `EMAIL_FROM` so the
DKIM `d=` stays aligned with the From domain. A user's address in From would fail DMARC
at the receiving inbox. Reply-To gives the same one-click reply with no extra setup.

## Storage

Both collections are created and indexed by migration `011_password_reset_tokens_indexes`
(`src/migrations/versions/`). Both rely on Mongo TTL indexes on `expires_at` for cleanup;
nothing in application code deletes rows by age.

| Collection | Fields | Indexes |
|---|---|---|
| `password_reset_tokens` | `token_hash`, `user_id`, `used`, `expires_at` | `token_hash` unique · `user_id` · TTL on `expires_at` |
| `password_reset_attempts` | `key` (case-folded email, or `support:<user_id>` for the support relay), `created_at`, `expires_at` | `key` · `created_at` desc · TTL on `expires_at` |

Attempt rows expire one window after they're written, so the throttle collection prunes
itself. Token rows outlive their expiry briefly (Mongo's TTL monitor runs roughly once a
minute), which is what makes the 410 path observable at all.

## Resend setup

One-time, per environment, done by a human in the Resend dashboard and Cloudflare:

1. Create a Resend account (free tier, no card) and an API key.
2. Add the sending domain in Resend. Use a **subdomain** (e.g. `send.<domain>`) as
   Resend's sending/return-path domain so its SPF record cannot conflict with Cloudflare
   Email Routing's SPF on the apex.
3. Add the DKIM + SPF records Resend displays into Cloudflare DNS (**DNS-only**, not
   proxied) and wait for the domain to show *Verified*.
4. Set `EMAIL_FROM` to an address on that domain, e.g.
   `Tarot Divinations <noreply@<domain>>`, and `RESEND_API_KEY` to the key. For a quick
   smoke test before the domain is verified, `EMAIL_FROM=onboarding@resend.dev` works but
   Resend will only deliver it to the address that owns the Resend account.
5. Set `FRONTEND_BASE_URL` to the real frontend origin — the link in the email is built
   from it verbatim.

Local dev normally leaves `RESEND_API_KEY` empty and reads the reset link out of the
console adapter's log line (`password reset email (console)`).

## Adding another email type

The port is deliberately narrow — one method per email the product sends, not a generic
`send(subject, body)`. To add, say, a welcome email:

1. Add `send_welcome(...)` as an abstract method on `EmailPort`.
2. Add `welcome_subject/_text/_html` to `templates.py` (plain-text and HTML both; inline
   styles only — there is no template engine).
3. Implement it on all three adapters. The Resend one follows `send_password_reset`
   exactly: build the `SendParams`, keep the `send_async` call *and* the response
   parsing inside the broad `try`, map everything to `EmailDeliveryError`.
4. Tests: `tests/notifications/test_templates.py` for wording,
   `test_adapters.py::test_adapters_implement_port` will fail until every adapter has the
   method.

## Need to know

- **The email's "expires in 30 minutes" is a hardcoded string.** `_TTL_WORDING` in
  `templates.py` is not derived from `password_reset_token_ttl_minutes`; change one,
  change the other.
- **`EmailDeliveryError` is a 502 that no client ever sees from the reset flow.** The
  handler catches it (step 5 above). The status exists for any future caller that
  *should* surface delivery failures.
- **The throttle case-folds; the account lookup does not.** `find_by_email` is an exact
  match, so a user registered as `Ann@x.com` must request the reset with that casing to
  get an email — while `ann@x.com` still burns their throttle budget. This is the
  existing behavior of login too, not something the reset flow introduced.
- **The throttle can over-count under a concurrent burst,** by design (record-then-count).
  Five genuinely simultaneous requests for one email may all get 429 even though only
  five are allowed; a retry a moment later succeeds. Erring this way is the point — the
  alternative order let a burst bypass the cap entirely.
- **The raw token exists in exactly two places:** the email (or the console log line in
  dev) and the URL the user clicks. The database only ever holds the hash. Dev logs
  therefore contain live reset links — don't ship console-adapter logs anywhere shared.
- **The Resend SDK authenticates through a module-level global** (`resend.api_key`),
  set once in the adapter's constructor. One key per process; don't construct two
  adapters with different keys.
- **A malformed Resend response is a delivery failure, not a crash.** The adapter reads
  `response["id"]` inside its `try`, so a missing id maps to `EmailDeliveryError` like
  any other SDK failure — which the reset handler then swallows. Without that, an SDK
  quirk would have produced a 500 only for existing accounts.
- **A reset token is single-use even if it turns out to be expired.** Step 1 marks it
  used before step 2 checks expiry. Harmless (the user requests a fresh one), but don't
  "fix" the ordering — the atomic consume is what makes reuse impossible.

## Quick file map

| Concern | File |
|---|---|
| Port contract | `src/notifications/port.py` |
| Resend adapter | `src/notifications/resend_adapter.py` |
| Console / mock adapters | `src/notifications/console_adapter.py`, `src/notifications/mock_adapter.py` |
| Boundary error | `src/notifications/errors.py` |
| Email wording | `src/notifications/templates.py` |
| Adapter selection, lifespan, mediator wiring | `src/main.py` |
| `EmailDep` | `src/core/dependencies.py` |
| Settings + env defaults | `src/core/config.py`, `.env.example` |
| Endpoints + request/response schemas | `src/auth/router.py`, `src/auth/schemas.py` |
| Request / confirm handlers | `src/auth/commands/request_password_reset.py`, `src/auth/commands/confirm_password_reset.py` |
| Token, throttle, refresh-token repositories | `src/auth/repository.py` |
| Reset-flow errors (400 / 410 / 429) | `src/auth/service.py` |
| Collections + TTL indexes | `src/migrations/versions/011_password_reset_tokens_indexes.py` |
| Support endpoint, schemas, handler, errors (429 / 503) | `src/support/router.py`, `src/support/schemas.py`, `src/support/commands/contact_support.py`, `src/support/service.py` |

## Tests to read first

- `tests/notifications/test_resend_adapter.py` — the payload Resend receives and the
  everything-maps-to-`EmailDeliveryError` contract.
- `tests/notifications/test_adapters.py` — the port is implemented by all adapters; the
  mock records sends.
- `tests/auth/test_password_reset_commands.py` — the two handlers in isolation:
  enumeration-safe no-op, token supersession, rate limit, swallowed delivery failure,
  session revocation, and the 400/410 split.
- `tests/auth/test_password_reset_router.py` — the HTTP round trip, including
  `test_full_reset_flow` (pulls the token out of `mock_email.sent_password_resets`).
- `tests/auth/test_password_reset_repos.py` — atomic consume, `count_recent` windowing,
  and `revoke_all_for_user` scoping.
- `tests/support/test_commands.py` / `tests/support/test_router.py` — the support relay:
  JWT identity wins over body fields, per-user throttle keyed apart from password reset,
  502 on delivery failure, 503 when `SUPPORT_EMAIL` is unset.
