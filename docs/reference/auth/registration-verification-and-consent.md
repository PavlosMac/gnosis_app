# Registration, Email Verification, Consent and Account Deletion

**Status: Live (implemented 2026-10-04).** How an account comes to exist, when it may hold
a session, how consent is recorded, and how it is removed. Rationale is in ADR-013 in
[`../../notes/decisions.md`](../../notes/decisions.md); the original plan was deleted once
it shipped (git history: registration-consent-verification-cookies.md). Frontend
side: [`frontend-auth-flow.md`](frontend-auth-flow.md). Email plumbing:
[`../email/email-service.md`](../email/email-service.md). Manual test script:
[`registration-qa-checklist.md`](registration-qa-checklist.md).

## User status

`UserStatus` (`src/auth/models.py`) is a `StrEnum` stored in `users.status`:

| Value | Meaning |
|---|---|
| `pending_verification` | Registered; the emailed link has not been confirmed. Cannot hold a session. |
| `active` | May log in. |

- **A document without `status` is active.** Accounts created before this feature have no
  field and there is no backfill; `user_status(doc)` is the one place that rule lives.
  `to_document()` always writes `status` for new users.
- **`SESSION_STATUSES` is the single extension point** (`src/auth/service.py`).
  `assert_may_hold_session(status)` raises `EmailNotVerifiedError` (403,
  `code: "email_not_verified"`) for any status not in the set. It is called in exactly
  three places: `AuthService.authenticate` (after the password check, so the 403 is not an
  existence oracle), `AuthService.refresh_tokens`, and `get_current_user`
  (`src/core/dependencies.py`). A later payment step adds `payment_required` to the enum
  and to `SESSION_STATUSES` (they must log in to pay); nothing else moves.
- Endpoints that take only `CurrentUserId` (readings, interpretations, dashboard) decode
  the JWT and check that its refresh family is live, but do not re-read the user. A pending
  user can never obtain a token, and account deletion ends every family — see
  [Need to know](#need-to-know).

## Endpoints

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| `POST /auth/register` | `{email, password, first_name, last_name, consents: {terms, privacy}}` | `201 {detail}`, no tokens | 409 duplicate email; 422, including `{detail, code: "weak_password"}`; 429 |
| `POST /auth/reset-password` | `{token, new_password}` | `200 {detail}` | 400, 410; `422 {detail, code: "weak_password"}` (the link is not consumed) |
| `POST /auth/login` | `{email, password}` | `200 TokenResponse` | 401; `403 {detail, code: "email_not_verified"}`; 429 |
| `POST /auth/verify-email` | `{token}` | `200 {detail}`, no tokens | 400 invalid / used / account gone, 410 expired |
| `POST /auth/resend-verification` | `{email}` | `200 {detail}` always | 429 |
| `POST /auth/consent` (bearer) | `{terms?, privacy?}`, at least one key | `200 UserResponse` | 401, 422 |
| `DELETE /auth/me` (bearer) | `{password}` | `204`, no body | 401 unauthenticated or account gone; `403 {detail, code: "invalid_password"}`; 422; 429 |
| `GET /auth/me` (bearer) | | adds `first_name`, `last_name`, `consents` (`{}` for legacy users), `status`, `email_verified_at` | 401; 403 when the status may not hold a session |

`AppError` carries an optional `code`; the global handler adds `"code"` to the body only
when it is set. The frontend branches on `code`, never on `detail` text.

**Wrong password on `DELETE /auth/me` is 403, not 401.** The caller is authenticated, and
the frontend treats any 401 as an expired access token: it would silently refresh and
retry, doubling the attempt and reporting "session expired". (The plan specified 401;
changed during implementation.)

## Password policy

`src/core/password_policy.py`, applied to **new** passwords only: registration
(`RegisterUserHandler`) and password reset (`ConfirmPasswordResetHandler`). Added 2026-10-05.

| Rule | Refusal message (`detail`) |
|---|---|
| 12 to 128 characters | "Password must be at least 12 characters" |
| Not on the bundled list `src/lib/passwords/common_passwords.txt` (case-insensitive) | "This password is too common. Choose a less predictable one." |
| Not one short unit repeated (`aaaa…`, `abcabc…`) and not a plain run (`123456789012`, `abcdefghijkl`) | same |
| Does not contain the email's local part, first name or last name (parts of 3+ characters) | "Password must not contain your name or email address" |

- A refusal is `WeakPasswordError`: 422 with `code: "weak_password"`. Its `detail` is
  written for the user, and the frontend shows it as the password field's error. This is
  the one code whose `detail` the frontend displays.
- **No character-mix rules, by decision.** Forced digits and symbols push people towards
  `Password1!`; length plus a blocklist is stronger and follows current NIST guidance.
- **No third-party breach lookup, by decision.** Sign-up has no outside dependency and
  the Privacy Policy needs no extra recipient.
- **Login does not apply the policy.** Accounts created under the older 8-character
  minimum keep working; the schemas' `min_length` (12) is only on register and reset.
  Every password field (login and delete-account included) is capped at
  `MAX_PASSWORD_LENGTH` (128) and rejects text that cannot be UTF-8 encoded (a JSON lone
  surrogate such as `\ud800`), so a request answers 422 and never reaches the hasher.
  The frontend's login and delete-account schemas carry the same cap.
- **A refused password never burns a reset link.** The handler checks strength first,
  reads the account through `OneTimeTokenRepository.peek()` for the name/email rule, and
  only then consumes the token.
- The list is ~1,400 entries of 12+ characters merged from two SecLists files (MIT);
  shorter common passwords already fail the length rule. The file header names the source.
  The frontend mirrors only the length and the name/email rule (`src/lib/password-policy.ts`).

## Emails are case-folded

`NormalizedEmail` (`src/auth/schemas.py`) strips and lower-cases on the way in for
register, login, forgot-password and resend. `RegisterUserHandler` stores the folded
address and `AuthReadRepository.find_by_email` folds its query, which also covers
`GetUserByEmailQuery` and the seed script. There is no migration for legacy mixed-case
addresses (data was expendable): such an account cannot be found until it is re-registered.

## Names and consent

- `first_name` and `last_name` are required (1–100, stripped). `display_name` is derived
  as `"First Last"` so every existing consumer keeps working. Legacy users have neither.
- `consents` on the user is `{"terms": {version, accepted_at}, "privacy": {version,
  accepted_at}}`. Registration stamps both with `accepted_at = now`.
- **The backend does not validate versions.** A version is the dated MDX filename the
  frontend owns (`"2026-10-04"`); the backend stores the string it is given, so a document
  edit needs no backend deploy.
- `POST /auth/consent` (`RecordConsentHandler` → `AuthWriteRepository.record_consent`)
  `$set`s dotted keys (`consents.terms`), so accepting one document never rewrites the
  other's record, and sets `updated_at` explicitly. A version that is already recorded
  is left untouched: `accepted_at` is evidence of when consent was given, and re-saving
  from the profile must not move it. It serves both the forced re-consent gate and the profile's self-service
  consent page.
- `GET /auth/me` always carries `consents` (`{}` for legacy users). The frontend reads an
  absent key as "backend predates consent" and skips its gate, so the key must stay.

## Verification token scheme

- `generate_url_token()` / `hash_token()` in `src/core/security.py`. The raw token exists
  only in the emailed link; the collection holds its SHA-256 hash.
- `OneTimeTokenRepository(db, collection)` (`src/auth/repository.py`) with two thin
  subclasses: `PasswordResetTokenRepository` and `EmailVerificationTokenRepository`.
  `consume()` atomically marks an unused token used and deliberately does not filter on
  expiry, so the handler can answer 400 (unknown/used) or 410 (expired).
- `issue_verification_email()` (`src/auth/service.py`) is shared by register and resend:
  delete the user's unused tokens, store a new hash with
  `email_verification_token_ttl_hours` (24), send
  `{frontend_base_url}/verify-email?token=...`.
- **Delivery failure is logged and swallowed** (error level, `user_id` only). Register
  still answers 201: the account already exists, so a 5xx would leave it half-created and
  a retry would 409. Resend is the recovery path.
- `VerifyEmailHandler` sets `status: active`, `email_verified_at`, `updated_at`, removes
  `verification_deadline_at`, and deletes all of the user's verification tokens. It
  issues no session tokens, so a leaked link never yields a login, and the route never
  touches `AuthService`.
- The frontend's `/verify-email` page renders a Confirm button and posts only on click, so
  a mail scanner that pre-fetches the link cannot burn the token.

## Resend: equal work on the request path

`POST /auth/resend-verification` answers the same 200 for unknown, active and pending
accounts. To keep them indistinguishable by response time, the request path only throttles
and looks the user up (`ResendVerificationHandler`, returns the user id or `None`). For a
pending account the router schedules `SendVerificationEmailCommand` as a FastAPI
background task, which runs after the response: it re-checks the status, moves the purge
deadline, rotates the token and calls the provider.

## Never-verified accounts are purged

`users.verification_deadline_at` is set at registration to now +
`pending_account_ttl_days` (7) and moved forward by every resend. Migration 014 puts a TTL
index on it (`expireAfterSeconds=0`) with the partial filter
`{status: "pending_verification"}`, so Mongo deletes the account once the deadline passes.
Active and legacy users never match; verifying removes the field as well. `created_at` is
never touched. A verification token whose user has been purged answers the same 400 as an
unknown token.

## Rate limits

`ThrottleRepository(db, collection, key_prefix)` — one collection
(`password_reset_attempts`, TTL-cleaned by migration 011), one key prefix per limiter.
`is_over_limit()` records the attempt and then counts, so a concurrent burst can only
over-throttle.

| Limiter | Stored key | Window / max | Where |
|---|---|---|---|
| Password reset | `<email>` | `password_reset_rate_limit_*` (3600s / 5) | `RequestPasswordResetHandler` |
| Support relay | `support:<user_id>` | `support_contact_rate_limit_*` (3600s / 5) | `ContactSupportHandler` |
| Resend verification | `verify:<email>` | reuses `password_reset_rate_limit_*` | `ResendVerificationHandler` |
| Login | `login:<ip>:<email>` | `login_rate_limit_*` (900s / 10) | `AuthService.authenticate` |
| Delete-account password | `login:delete:<user_id>` | `login_rate_limit_*` | `AuthService.confirm_password` |
| Register | `register:<ip>` | `register_rate_limit_*` (3600s / 10) | `RegisterUserHandler` |

- Login is keyed by IP **and** email: by email alone an attacker could lock the owner
  out; by IP alone one address could try every account. The throttle runs before the
  lookup, so the 429 is identical for known and unknown emails.
- **The client IP comes from `X-Forwarded-For`** (`get_client_ip`,
  `src/core/dependencies.py`). Every request reaches the API from the Next.js server, so
  the socket peer is the same for all users; the frontend forwards the browser address
  (`src/lib/api-client.ts`). This is trusted because the API has no host port in
  production. If the API is ever exposed directly, set
  `RATE_LIMIT_TRUST_FORWARDED_FOR=false`.
- **The forwarded address is only as trustworthy as the edge.** The frontend prefers
  `CF-Connecting-IP`, which Cloudflare overwrites, so production is sound. Where the
  frontend is reachable without Cloudflare (dev, LAN, direct origin access) a caller can
  send its own header and get a fresh throttle key per request.

## Account deletion

`DELETE /auth/me` re-verifies the password (`AuthService.confirm_password`, throttled),
then sends `DeleteUserCommand`. `DeleteUserHandler` (`src/auth/commands/delete_user.py`)
removes, in this order:

1. `refresh_tokens` for the user (sessions end first)
2. `interpretations` (and with them the per-interpretation usage ledger)
3. `readings`
4. `user_tags`
5. `password_reset_tokens` and `email_verification_tokens`, used and unused
6. throttle records keyed by the user's email or id
7. the `users` document (which holds the usage aggregate and the consent record)

The user document goes last, so a failure midway leaves an account that can simply be
deleted again. **A new collection that stores a `user_id` must be added to this handler.**
The API is bearer-only; the frontend clears its cookies.

Out of scope: data export (access requests go through `POST /support/contact`), backup
retention (a deleted account remains in existing database backups until they rotate),
and name editing.

## Logging

No emails, names, tokens or links in log fields; `user_id` only. `ConsoleEmailAdapter`
logs a link only when constructed with `reveal_links=True`, which `main.py` does for
`APP_ENV=development` alone — a production deploy that is merely missing
`RESEND_API_KEY` runs the console adapter and must not write live tokens to its logs.
`ResendEmailAdapter` no longer logs the recipient.

## Need to know

- **An access token lives only as long as its session.** `CurrentUserId`
  (`get_current_user_id`) checks that the token's `family_id` still has a row in
  `refresh_tokens` (`RefreshTokenRepository.family_is_live`, one indexed lookup per
  request, run in parallel with the user lookup in `get_current_user`). Logout, password reset, account deletion and refresh-replay detection all
  delete the family, so the access token answers 401 at once instead of surviving up to
  an hour (`jwt_access_token_expire_seconds`, 3600). Refresh rotation keeps the family,
  so the previous access token stays valid until it expires. A token without a
  `family_id` is refused. A refresh token replayed within 10 s of its rotation
  (`REFRESH_REPLAY_GRACE_SECONDS`; two tabs or a proxy plus a render racing) answers 401
  without revoking the family, so the winner's session survives; a later replay is
  treated as theft. Other sessions of the same user are untouched by a logout.
- **Legacy users have `consents: {}`** and are sent to `/accept-terms` by the frontend
  once.
- **`register:<ip>` throttle records** carry a network address, not an account identity,
  so account deletion leaves them to expire (one hour).

## File map

| Concern | File |
|---|---|
| Status enum, `user_status` | `src/auth/models.py` |
| Schemas, `NormalizedEmail` | `src/auth/schemas.py` |
| Password policy and blocklist | `src/core/password_policy.py`, `src/lib/passwords/common_passwords.txt` |
| Errors, `SESSION_STATUSES`, `issue_verification_email`, login throttle | `src/auth/service.py` |
| Token and throttle repositories | `src/auth/repository.py` |
| Commands | `src/auth/commands/{register_user,verify_email,resend_verification,send_verification_email,record_consent,delete_user}.py` |
| Endpoints | `src/auth/router.py` |
| `ClientIp`, `get_current_user` status check | `src/core/dependencies.py` |
| Migrations | `src/migrations/versions/013_email_verification_tokens_indexes.py`, `014_pending_users_ttl.py` |
| Tests | `tests/auth/test_email_verification_{router,commands}.py`, `test_consent_router.py`, `test_delete_account_router.py`, `tests/migrations/test_email_verification_migrations.py` |
