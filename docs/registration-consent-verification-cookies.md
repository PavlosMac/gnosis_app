# Finish user registration: names + consent, email verification, cookie hardening

**Date:** 2026-09-30 · **Updated:** 2026-10-01 (ultracode feasibility review) · **Scope:** `backend/` + `frontend/` · **Status:** implemented 2026-10-04 (one manual step left: the Pi, see Phase 6 row)

| Phase | Status |
|---|---|
| 1. Shared cookie module + token lifetime (frontend) | done 2026-10-04 |
| 2. Backend names, consents, `/auth/consent`, email normalisation | done 2026-10-04 |
| 3. Frontend consent, incl. self-service consent management (Features 1–4) | done 2026-10-04 |
| 4. Email verification + auth hardening (backend + frontend) | done 2026-10-04 |
| 5. Account deletion (backend + frontend) | done 2026-10-04 |
| 6. Env, deploy docs, ADR-012–014, memory files | done 2026-10-04 in the repo. **Not done: the Pi.** Sign-up defaults to closed in `frontend/docker-compose.yml` (changed 2026-10-05, see Deviations), and the compose file and `.env.gnosis.prod` actually on the Pi were not reachable and still need the new variables (`backend/docs/deployment/deploy_instructions.md` §3–3b) |

### Deviations from this plan (2026-10-04)

Found during the per-phase review and implementation. As-built references:
`backend/docs/auth/registration-verification-and-consent.md`, frontend ADR-012 to ADR-014.

- **Per-IP rate limits needed the real client IP.** Every backend call comes from the
  Next.js server, so `register:<ip>` and `login:<ip>:<email>` would have been keyed on one
  address for all users. `publicFetch` now forwards the browser address in
  `X-Forwarded-For` and the backend reads it (`RATE_LIMIT_TRUST_FORWARDED_FOR`).
- **Wrong password on `DELETE /auth/me` is `403 {code: "invalid_password"}`, not 401.**
  The frontend treats a 401 as an expired token and silently refreshes and retries.
- **The delete-account page is exempt from the consent gate.** As planned, a user who
  declined a new Terms version could not have reached it. The proxy passes the pathname
  to layouts in an `x-pathname` header.
- **Console adapter: links are logged only when `APP_ENV=development`.** The plan asked
  both to redact links and to read them from the dev log.
- **Resend timing fix uses a FastAPI background task** for the whole token issue and
  send, so the three branches do the same work on the request path.
- **The legal registry is generated** (`npm run legal:registry`, run before dev, build and
  test) and committed; a test pins it to the directory listing.
- **`mdx-components.tsx` is in `frontend/src/`**, which Next requires with a `src` directory.
- **The documents are dated `2026-10-04`** (the day they were written), not `2026-09-30`.
- **Delete-account password checks are throttled** with the login limits, and deletion
  also removes throttle records that name the account.
- **The consent gate also runs in each page** (`enforceOnboarding()`), because a layout is
  not re-rendered on client-side navigation; `/accept-terms` joined the proxy matcher.
- **Re-saving an unchanged consent version does not move `accepted_at`.** The plan called
  the re-save a harmless `$set`; it would have overwritten the original acceptance date.
- **Guarded actions on public pages** tell a logged-in user with stale consent to accept
  the terms instead of "you must be logged in", and the inline login redirects to the gate.
- **Production sign-up defaults to closed** (decision changed 2026-10-05). This plan
  said to flip `REGISTRATION_ENABLED` on in production; `frontend/docker-compose.yml` now
  defaults it to `false`, so sign-up is opened deliberately on the Pi at launch.
- **`make dev` exports `REGISTRATION_ENABLED=true`** so the register page works locally.
- **Open risks** (from the final code review). Resolved 2026-10-10: contact support no
  longer requires current consent and is linked from `/accept-terms`; Google Analytics
  is removed. Left as documented, by decision: an access token stays usable for up to an
  hour after account deletion on endpoints that only decode the JWT; a pending
  registration holds an email for 7 days and whoever confirms the link activates the
  account with the registrant's password (pre-hijacking); the forwarded client address is
  spoofable where Cloudflare is not in front; the 24-hour and 7-day figures in the UI
  are constants that mirror backend settings.
- `register_verify_and_login` and `make_register_body` live in `tests/factories.py`
  (plain functions), with the fixtures in `tests/conftest.py` built on them.

This document is the reference point for the work; update the status table as phases land.
Companion design: `frontend/docs/gdpr-consent-terms-and-named-registration.md`.

> **2026-10-01 feasibility review (ultracode, 33 agents, codebase-verified):** the plan as
> originally written satisfied condition 3 (DB consent record) but **failed condition 4**
> (account deletion was explicitly out of scope) and **failed condition 2** (profile only
> showed consent read-only, no self-service change path) against the four requirements the
> operator set for this feature: 1. secure signup with T&C/Privacy approval, 2. login +
> change consent from profile/account, 3. DB record of consent + document version, 4. system
> open to removing exiting users. This revision folds in Phase 5 (account deletion), Feature
> 4 in Phase 3 (self-service consent management), and security fixes (rate limiting, timing
> oracles, PII logging, test blast radius, migration numbering) found during that review.

## Context

Registration today (behind the frontend-only `REGISTRATION_ENABLED` flag) collects email,
password and an optional display name, auto-logs the user in, and records no consent.
The goal is a registration flow a real user can go through: first/last name + email,
required acceptance of Terms and Privacy Policy, a hard email-verification gate (the user
confirms via an emailed link before any session exists), password reset already in place,
and hardened session cookies. The design must leave room for a later payment step in
onboarding without a redesign.

Decisions taken with the user (2026-09-30):
- Consent exactly per `frontend/docs/gdpr-consent-terms-and-named-registration.md`
  (versioned MDX legal docs, `{version, accepted_at}` per document, `/accept-terms` gate,
  Agreements rows on the profile).
- Email verification is a **hard gate** with a user `status` enum
  (`pending_verification | active`; `payment_required` slots in later). The verify page
  has a Confirm button (mail scanners cannot burn the token); on success it shows "Email
  confirmed, please sign in" and links to `/user/login`. No session exists until the user
  logs in explicitly after confirming.
- Password reset stays as is (it is already shipped both sides); this work only closes
  gaps around it (email case-folding, prod env, stale docs).
- Cookies: harden the three httpOnly session cookies (one shared writer, `__Host-` in
  prod). No cookie-consent banner and no GA gating: out of scope, recorded.
- No welcome email, no passwordless login, no backfill migrations (data is expendable).
- Account deletion is **in scope** (added 2026-10-01): a self-service `DELETE /auth/me`
  with cascading cleanup, not a support-ticket-only process. See Phase 5.
- Consent is **user-revisitable, not only operator-forced**: the profile page gets a
  "Review / change consent" action wired to the existing `POST /auth/consent` at any time,
  in addition to the forced `/accept-terms` gate on a version bump. See Phase 3, Feature 4.
- Rate limiting added to `/auth/login`, `/auth/register`, and `/auth/resend-verification`
  (the last already throttled in the original plan) by generalising the existing
  `PasswordResetThrottleRepository`. See Phase 4.
- `REGISTRATION_ENABLED` is flipped on in the actual prod compose/env file as part of this
  plan (Phase 6), not left as a documentation note for later.

### Verified state (survey 2026-09-30)

| Piece | State |
|---|---|
| `REGISTRATION_ENABLED` | Frontend-only: `src/lib/feature-flags.ts`, enforced in `src/proxy.ts:41`, `register/actions.ts:13`, `login-form.tsx` (hides link). Not exported by any Makefile/compose/Dockerfile, so unset in prod. Backend `/auth/register` always open. |
| Names / consent | Nothing implemented on either side; only the design doc (commit 6ed9964). |
| Password reset | Done both sides (backend migration 011, `/forgot-password`, `/reset-password`; frontend pages + profile "Renew the Seal"). `backend/docs/auth/password-reset-flow.md` header and `backend/docs/README.md` still say "unimplemented". |
| Email service | Done: `EmailPort` with `send_password_reset`, `send_support_request`; Resend adapter when `RESEND_API_KEY` set, else console adapter (logs links). Recipe for a new mail type in `backend/docs/email/email_service.md`. |
| Email verification | None. Register mints tokens in the router right after the handler; test fixtures `auth_token`/`superadmin_token` rely on that. |
| Cookies | `access_token`, `refresh_token`, `token_expires_at`; httpOnly, `secure` in prod, lax, path `/`; written in both `src/lib/api-client.ts` and `src/proxy.ts`. Backend is pure bearer JSON. Access token default 86400s in `backend/src/core/config.py` but 3600 in `.env.gnosis.prod.example` and 60 min in `frontend/docs/auth/auth-flow.md`. |
| Email casing | `find_by_email` exact-match; reset throttle case-folds. |
| Prod env | `backend/.env.gnosis.prod.example` + `deploy_instructions.md` lack `RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_BASE_URL`, `SUPPORT_EMAIL` (fresh deploy would email localhost links). `REGISTRATION_ENABLED` is unset in every prod file, so signup stays disabled after a fresh deploy unless Phase 6 sets it. |
| Rate limiting | None on `/auth/login` or `/auth/register`; `PasswordResetThrottleRepository` only guards password-reset requests (found 2026-10-01). |
| Account deletion | None: no delete-user endpoint, admin tool or script. `POST /support/contact` only emails a human; no ticket persistence, no deletion runbook (found 2026-10-01). |
| Conventions | Next ADR = 012; next migration = 013. Server actions re-check auth themselves (`frontend/CLAUDE.md`). React 19 `useActionState` wipes inputs: echo `values`, never passwords (`bugs.md` 2026-09-15). No PII in backend logs. Backend: new field → readers tolerate absence; new setting → config + `.env.example` + `.env.gnosis.prod`. Frontend tests: vitest, no jsdom, `renderToStaticMarkup`. |

## Phases

Each phase leaves `make test` green and `make dev` usable. Order: cookie refactor
(isolated) → backend additive fields → frontend consent (incl. self-service consent
management) → verification + auth hardening both sides (the register contract changes, so
together) → account deletion → docs/env.

### Phase 1: shared cookie module (frontend)

Create `frontend/src/lib/auth-cookies.ts` (edge-safe, no `next/headers`):
- `cookieNames(secure: boolean)` → `__Host-access_token` etc. when secure, plain names otherwise; `AUTH_COOKIES()` lazy getter on `NODE_ENV === "production"` (lazy per the middleware `process.env` lesson).
- `applyAuthCookies(target, tokens, now?)`, `clearAuthCookies(target)`, `readAuthCookies(source)`; `target` is anything with `set(name, value, opts)` (both `await cookies()` and `NextResponse.cookies`). Options: `httpOnly, sameSite: "lax", path: "/", secure`, no `domain`. Clear via `set(name, "", {...sameOpts, maxAge: 0})`, never `delete` (a `__Host-` deletion without `Secure` is dropped by browsers).
- `src/lib/api-client.ts`: `setAuthCookies`/`clearAuthCookies` become wrappers (keep exported names so actions are untouched); reads use the constants. `src/proxy.ts`: replace `setCookiesFromTokenResponse`, the three reads and the three deletes.
- Token lifetime: set `jwt_access_token_expire_seconds = 3600` in `backend/src/core/config.py` and `backend/.env.example` (prod example already 3600; docs say 60 min; 10s proactive threshold is tuned for it).
- Tests first: `src/lib/__tests__/auth-cookies.test.ts` (names by env; three `set` calls with the right options and `maxAge = expires - now` floored at 0; clear uses `set` with `maxAge: 0`; `readAuthCookies` parses/undefineds).
- Note: renaming cookies logs everyone out once; `__Host-` needs HTTPS, so `NODE_ENV=production` on plain http cannot log in (prod is behind the Cloudflare tunnel, fine).

### Phase 2: backend names, consents, `/auth/consent`, email normalisation

Additive only; the current frontend keeps working (unknown response keys ignored).
- `src/auth/schemas.py`: `NormalizedEmail = Annotated[EmailStr, AfterValidator(strip+lower)]` on `RegisterRequest`, `LoginRequest`, `PasswordResetRequestRequest`. `RegisterRequest` gains `first_name`, `last_name` (1–100, **optional in this phase**, required in Phase 4), `consents: ConsentVersions | None` (`{terms, privacy}` strings); drop `display_name` from the request. `ConsentRecord {version, accepted_at}`; `ConsentRequest {terms?, privacy?}` with a model validator requiring ≥1 key. `UserResponse` + `UserReadModel` gain `first_name`, `last_name` (null legacy) and `consents: dict[str, ConsentRecord]` defaulting to `{}` (so `/me` always carries it; the frontend's "absent = old backend" rule keys on this).
- `src/auth/models.py`: `User` gains `first_name`, `last_name`, `consents`; `to_document` omits when None/empty; `from_document` uses `.get`.
- `src/auth/commands/register_user.py`: strip names; `display_name = f"{first} {last}"` when both given; write `consents.<doc> = {version, accepted_at: now}`.
- New `src/auth/commands/record_consent.py`: `RecordConsentCommand(user_id, terms?, privacy?)`; `$set` dotted keys `consents.terms` etc. plus `updated_at` (inherited `update()` does not touch it). Router `POST /consent` (`CurrentUser`) re-reads via `GetUserByIdQuery`, returns `UserResponse`. Register in `main.py::_wire_mediator`.
- `src/auth/repository.py`: `find_by_email` case-folds too (covers seed script and `GetUserByEmailQuery`). `request_password_reset.py`: drop its local lower-casing; fix the PII log at line 80 (logs the email; log `user_id`). `scripts/seed_superadmin.py`: lowercase.
- No migration for legacy mixed-case emails (deliberate: data expendable; re-register dev accounts if needed).
- Tests first: `tests/auth/test_commands.py` (display_name derived; consents stored with accepted_at), `tests/auth/test_router.py` (register normalises email; login case-insensitive; `/me` has `consents == {}` for a doc inserted without it), new `tests/auth/test_consent_router.py` (401; single-key upsert leaves the other untouched; both keys; empty → 422), `tests/auth/test_repository.py` (case-fold).

### Phase 3: frontend consent (Features 1–3 of the design doc)

Follow the design doc's file list; deltas noted here.
- **Feature 1**: `npm --prefix frontend i @next/mdx @mdx-js/loader @mdx-js/react @types/mdx`; `next.config.ts` `createMDX()` + `pageExtensions`; root `mdx-components.tsx`; `src/content/legal/README.md`, `terms/2026-09-30.mdx`, `privacy/2026-09-30.mdx` (dated today; privacy must mention the verification email and the consent record; draft for legal review); `src/lib/legal-versions.ts` (pure), `src/lib/legal-documents.ts` (`server-only`; `listVersions`, `currentVersion`, `CURRENT_VERSIONS`, `loadDocument`), `src/lib/consent.ts` (`staleConsents`), `src/components/LegalDocument.tsx`, `src/app/legal/[doc]/page.tsx`, `src/app/legal/[doc]/[version]/page.tsx`; footer links in `TarotLanding.tsx` and an `AuthFootnote` on login/register. Risk: Turbopack template-literal `import()`; fallback = a static thunk registry in `legal-documents.ts` with a test asserting its keys equal the directory listing. Tests: `src/lib/__tests__/legal-versions.test.ts`, `consent.test.ts`.
- **Feature 2**: `src/types/auth.ts` (`firstName`, `lastName`, `consents?`, `RegisterEchoValues`, wire fields on `MeResponse`/`UserResponse`, mappers); `auth-schemas.ts` (`emailField` trim+lowercase to mirror backend; `firstName`/`lastName` 1–100; `acceptTerms`/`acceptPrivacy: z.literal("on")`; drop `displayName`); split `register/page.tsx` (server, passes `<LegalDocument/>` nodes) + `register/register-form.tsx` (client; echoes `state.values` into `defaultValue`; `AuthCheckbox` rows whose label links open `SanctumModal size="lg"`); `AuthCheckbox` added to `src/components/AuthField.tsx`; `register/actions.ts` sends `first_name`, `last_name`, `consents` from `CURRENT_VERSIONS` (never from the form), returns `values` on failure, drops the email from its log. Profile: export `ProfileRow`/`SectionLabel` from `AccountPanel.tsx`; new `AgreementRows.tsx`; `agreementRowModel()` in `src/lib/profile-dashboard.ts` (+ test). Name row falls back to first+last. Tests: new `src/lib/__tests__/auth-schemas.test.ts`.
- **Feature 3 + onboarding hook**: new pure `src/lib/onboarding.ts`:
  `onboardingRedirect(user, currentVersions): "/verify-email" | "/accept-terms" | null`
  (status pending → `/verify-email` [real in Phase 4]; future `payment_required` → one more branch; stale consents → `/accept-terms`). `src/app/user/layout.tsx` and `superadmin/layout.tsx` become async and `redirect()` on a non-null result (unauthenticated visitors untouched). `src/lib/session.ts` gains `requireConsentedUser()` = `getCurrentUser()` filtered by `onboardingRedirect(...) === null`; swap it into `createReading`, `generateInterpretation` (`src/app/user/interpret/actions.ts`, which is also the manual-reading save path; the doc's `manual-reading/actions.ts` does not exist), `updateReadingTags`, `contactSupport`. New `src/app/accept-terms/{page.tsx, accept-form.tsx, actions.ts}` per the doc (lists only stale docs; posts ticked versions to `/api/v1/auth/consent`; Log out link). Test: `src/lib/__tests__/onboarding.test.ts`.
- **Entry points to the form** (new; today the only link is the login-page footnote, flag-gated). The flag is a server-only env var, so expose it once: the root `src/app/layout.tsx` (server) reads `isRegistrationEnabled()` and passes `registrationEnabled` into `AuthProvider`; `useAuth()` returns it alongside `user`. Then:
  - `src/components/ProfileNav.tsx`: the logged-out dropdown shows "Login" and, when enabled, "Sign up" → `/user/register`.
  - `src/components/LoginToInterpretModal.tsx`: an `AuthFootnote` under the inline form, "No account yet? Begin your journey" → `/user/register` (leaves the modal; the return path is not preserved because registration ends at the check-your-email panel, not a session).
  - `src/components/TarotLanding.tsx`: one "Begin your journey" link beside the Terms · Privacy footer line, same gate.
  - `login/page.tsx` keeps its existing footnote; `login-form.tsx` can drop its prop and read the flag from `useAuth()` so there is one source.
  - Disabled flag: links are hidden and `src/proxy.ts` still redirects any stale `/user/register` hit to login. Test: `src/components/__tests__/ProfileNav.layout.test.tsx` pattern (`renderToStaticMarkup`, mocked `useAuth`) asserting the Sign up link renders only when enabled.
- Existing users (`consents: {}`) hit `/accept-terms` once after this phase; intended.
- **Feature 4 (added 2026-10-01): self-service consent management.** Existing users must be
  able to revisit consent on their own initiative, not only when a document version bumps —
  this is a hard requirement (condition 2), not a nice-to-have. New
  `src/app/user/profile/manage-consent/{page.tsx,actions.ts}` (linked from the existing
  `AgreementRows` block via a "Review / change" link): lists both current documents with
  checkboxes pre-ticked to the user's current acceptance state, links to the full text via
  the same `SanctumModal` pattern as registration, and a Save action that
  `authenticatedFetch`es `POST /api/v1/auth/consent` with whichever keys were (re-)ticked —
  the backend endpoint already accepts any subset with no version validation, so no backend
  change is needed. Unticking and saving is **not** supported (there is no "withdraw consent
  while keeping the account" state in this design — a user who declines either document logs
  out, same as the forced-gate path); the UI makes this explicit rather than silently
  no-op'ing an unchecked box. Test: a unit test on the save action's payload construction
  (only ticked docs sent; an already-current doc re-saved is a no-op `$set` to the same
  value, which is harmless).

### Phase 4: email verification + auth hardening (backend + frontend in one change)

Backend:
- `src/core/security.py`: `generate_url_token()`, `hash_token()`; reset commands switch to them.
- `src/core/exceptions.py`: `AppError(status_code, detail, code: str | None = None)`; handler adds `"code"` only when set.
- `src/core/config.py`: `email_verification_token_ttl_hours = 24`; resend throttle reuses the password-reset window/max settings. `constants.py`: `EMAIL_VERIFICATION_TOKENS_COLLECTION`.
- `src/auth/models.py`: `UserStatus(StrEnum)`; `User.status` default `ACTIVE`, `email_verified_at`; `from_document` treats a missing field as active (no backfill); `to_document` always writes `status`. `UserResponse`/`UserReadModel` gain both.
- `src/auth/schemas.py`: `first_name`, `last_name`, `consents` become required; `RegisterResponse {detail}`; `VerifyEmailRequest {token}`; `VerifyEmailResponse {detail: "Email confirmed. You can now sign in."}`; `ResendVerificationRequest {email: NormalizedEmail}`; `ResendVerificationResponse {detail}`.
- `src/auth/service.py`: errors `EmailNotVerifiedError` (403, `code="email_not_verified"`), `InvalidVerificationTokenError` 400, `ExpiredVerificationTokenError` 410, `TooManyVerificationRequestsError` 429. **Single extension point**: `SESSION_STATUSES = {ACTIVE}` + `assert_may_hold_session(status)`; called in `authenticate` (after password check, so a 403 is not an existence oracle), `refresh_tokens`, and `get_current_user` in `src/core/dependencies.py`. Shared `issue_verification_email(...)`: invalidate old tokens, store hash with TTL, send `{frontend_base_url}/verify-email?token=...`, swallow `EmailDeliveryError` with an error-level log (`user_id` only).
- `src/auth/repository.py`: generalise `PasswordResetTokenRepository` into `OneTimeTokenRepository(db, collection)` with two thin subclasses.
- Commands: `register_user.py` (creates pending user, issues mail, returns id; router returns 201 `RegisterResponse`, no tokens); new `verify_email.py` (consume → 400/410 split like `confirm_password_reset.py`; set active + `email_verified_at` + `updated_at`; invalidate; router returns 200 `VerifyEmailResponse`, no tokens, so the verify route never touches `AuthService`); new `resend_verification.py` (throttle key `verify:<email>` recorded before lookup; no-op for unknown/active; always 200). Wire in `main.py`.
- Notifications: `send_email_verification(to, verify_link)` on the port + console/mock (`sent_email_verifications`)/Resend adapters; `templates.py` `email_verification_{subject,text,html}` with TTL wording derived from the setting.
- Migration `013_email_verification_tokens_indexes.py` (copy of 011 for the new collection, verification tokens only — kept to one logical concern per migration, matching every prior migration 001–011). `seed_superadmin.py` writes `status: active`. The pending-account TTL purge index (see **Open point** below) is a separate migration, `014_pending_users_ttl.py`, not bundled into 013 (found 2026-10-01: the original draft mixed two unrelated concerns in one migration).
- **Rate limiting (added 2026-10-01):** generalise `PasswordResetThrottleRepository` into a
  `ThrottleRepository(db, collection, key_prefix)` — already implied by reusing it for
  resend-verification — and apply it to `/auth/login` (key `login:<ip>:<email>`) and
  `/auth/register` (key `register:<ip>`, no email to key on pre-account). The login throttle
  must not become a new enumeration or lockout-via-attacker oracle: key by IP+email together,
  and return the same 429 shape regardless of whether the email exists.
- **Resend-verification timing-oracle fix:** the original draft returns 200 for all three
  branches (unknown, active, pending) but only the pending branch does a DB write plus a
  synchronous `resend.Emails.send_async` call, making branches distinguishable by response
  time. Fix by moving the email send off the request's critical path (fire-and-forget task or
  queue) for the pending branch, or by adding a matching artificial delay to the no-op
  branches.
- **PII-in-logs fix, done before this phase wires the new send method (added 2026-10-01):**
  `console_adapter.py` currently logs the full raw reset link (including the unhashed token)
  and `resend_adapter.py` logs the recipient email on every send. Redact both (`reset_link` /
  `verify_link` to a non-secret marker, `to` to absent or hashed) before adding
  `send_email_verification`, so the new verification token isn't logged the same way the
  reset token is today — a prod deploy missing `RESEND_API_KEY` runs the console adapter,
  so this isn't dev-only.
- Tests first: `tests/conftest.py` helper `register_verify_and_login(client, mock_email, email, password) -> TokenResponse dict` (register → pull token from the mock's `verify_link` → verify → login), rewrite `auth_token`/`superadmin_token` on it and switch every test that calls `/auth/register` or constructs `RegisterUserHandler`/`RegisterUserCommand` directly — the six HTTP-level test files found in the original survey **plus** `tests/auth/test_commands.py` and `tests/auth/test_queries.py` (found 2026-10-01: both instantiate `RegisterUserHandler` directly with the old 2-arg constructor and will break once this phase adds the email-port and verification-token-repo dependencies); `tests/factories.py` `make_register_body(...)`. New `tests/auth/test_email_verification_router.py` (201 no tokens; pending login 403 with code; wrong password 401; verify → 200 `{detail}` with no tokens, then login succeeds and `/me` is active with `email_verified_at`; reuse 400; expired 410; resend rotates token; resend unknown/active → 200 silent; resend 429; missing names/consents 422; legacy doc without status logs in). New `tests/auth/test_email_verification_commands.py` (hashed at rest; delivery failure swallowed, user still pending). `tests/notifications` port/template cases. Migration test.

Frontend:
- `src/types/api.ts`: `ApiError.code?: string`; `api-client.ts` `publicFetch`/`authenticatedFetch` read the error body once and surface `code` when it is a string.
- `src/types/auth.ts`: `UserStatus`, `User.status` (mapper defaults `"active"`), `emailVerifiedAt`; `LoginFormState.emailNotVerified?`; `VerifyEmailFormState { tokenProblem?: "invalid" | "expired" }`; `ResendVerificationFormState`. `auth-schemas.ts`: `verifyEmailSchema`, `resendVerificationSchema`.
- `register/actions.ts`: on 201 return `{success: true}` (no cookies, no redirect); `register-form.tsx` shows a "check your email" panel (24h wording, "Didn't get it? Resend" link to `/verify-email`).
- New `src/app/verify-email/{page.tsx (server, reads ?token=), verify-email-form.tsx (client), actions.ts}` mirroring `/reset-password`: hidden token input + one Confirm `AuthSubmitButton`; action maps 400 → invalid, 410 → expired; on 200 return `{success: true}` and the form renders a success panel ("Email confirmed. Enter the Sanctum" `AuthLink` to `/user/login`); no cookies are set here. No token / problem → dead-link panel containing the resend form (always-success copy). Outside the proxy matcher. New `src/lib/email-verification.ts` `requestVerificationEmail(email)` (mirror of `password-reset.ts`).
- `login/actions.ts`: `status === 403 && code === "email_not_verified"` → error copy + `emailNotVerified: true`; `login-form.tsx` shows an `AuthLink` to `/verify-email`; `loginInline` gets the same copy via `error`.
- `onboarding.ts` pending branch becomes real; tests for new schemas and the pending case.

### Phase 5: account deletion (backend + frontend, added 2026-10-01)

Closes condition 4 (the system must be open to removing users who wish to exit). Self-service,
not support-ticket-only — the plan's original "handle it via `POST /support/contact`" path is
an inbox, not a mechanism, and does not satisfy the requirement.

Backend:
- `src/auth/schemas.py`: `DeleteAccountRequest {password: str}` (re-authenticate before a
  destructive action).
- `src/auth/service.py`: `AuthService.delete_account(user_id, password)` — verify password via
  the existing Argon2 check, raise the existing invalid-credentials error on mismatch.
- New `src/auth/commands/delete_user.py`: `DeleteUserCommand(user_id)` — cascading delete
  using the existing `BaseWriteRepository.delete()` pattern across every collection that
  references the user: `users`, refresh-token / password-reset-token / email-verification-token
  collections (already have or need a `delete_by_user_id` method from the password-reset and
  verification work), readings, interpretations, usage ledger. Enumerate the actual collection
  list from `backend/docs/database/model_references.md` rather than guessing.
- Router `DELETE /auth/me` (`CurrentUser`, body `DeleteAccountRequest`): re-verify password,
  run the cascade, return 204. Clearing cookies is a frontend concern (the backend is
  bearer-only). Register in `main.py::_wire_mediator`.
- Tests first: `tests/auth/test_delete_account_router.py` (401 unauthenticated; 401 wrong
  password; 204 + user gone from every collection on success; a second call 401s since the
  user no longer exists). `tests/auth/test_commands.py` for the cascade (seed a user with a
  reading, a refresh token, a consent record; assert all gone after the command runs).

Frontend:
- `src/types/auth.ts`: `DeleteAccountFormState`. `auth-schemas.ts`:
  `deleteAccountSchema { password, confirm: z.literal("DELETE") }` (type-to-confirm, not just
  a checkbox, given this is irreversible).
- New `src/app/user/profile/delete-account/{page.tsx,delete-account-form.tsx,actions.ts}`:
  password field + a literal "DELETE" confirmation field + a danger-styled submit button;
  action calls `authenticatedFetch("/api/v1/auth/me", {method: "DELETE", ...})`, then
  `clearAuthCookies(await cookies())` and `redirect("/")` on success, or a field error on
  wrong password.
- `AccountPanel.tsx`: a "Delete account" danger-zone link at the bottom of the profile,
  visually separated from the Agreements/profile rows.
- Verification: unit test on `deleteAccountSchema` (wrong confirm text → field error);
  manual: delete a dev account via `make dev`, confirm it disappears from Mongo and the
  session is logged out; confirm wrong password is rejected without deleting anything.

### Phase 6: env, deploy docs, ADRs, memory files

- `backend/.env.example`: `JWT_ACCESS_TOKEN_EXPIRE_SECONDS=3600`, `#EMAIL_VERIFICATION_TOKEN_TTL_HOURS=24`. `backend/.env.gnosis.prod.example`: add `RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_BASE_URL=https://tarotdivinations.com`, `SUPPORT_EMAIL`, the TTL. `deploy_instructions.md`: list them as required; add a frontend-container subsection stating `REGISTRATION_ENABLED` and `GNOSIS_API_BASE_URL` are supplied by nothing in the repo (recommend an `env_file` on the frontend compose service; confirm the Pi's actual compose first).
- **Actually set `REGISTRATION_ENABLED=true` in the real prod compose/env file as part of
  this phase** (added 2026-10-01) — the original plan only recommended documenting the gap,
  which leaves signup disabled in prod after every other phase ships. Confirm the Pi's actual
  compose file and add the var there, not just in `*.example`.
- Fix stale headers: `backend/docs/auth/password-reset-flow.md` ("Implemented 2026-09-14; as-built in `docs/email/email_service.md`"), `backend/docs/README.md`. New live doc `backend/docs/auth/registration-verification-and-consent.md` (status enum + absent-means-active, `SESSION_STATUSES` extension point, token scheme, endpoints/error codes, log-and-201 decision, throttle prefix, rate-limit keys, account-deletion cascade). Update `backend/docs/database/model_references.md` (users fields, new collections, indexes 013/014) and `backend/docs/email/email_service.md` (third mail type; remove the case-fold gotcha; note the redacted-logging fix).
- `frontend/docs/project_notes/decisions.md`: ADR-012 consent (the design doc's housekeeping text, renumbered from 011), ADR-013 hard verification gate (confirm before first login; verify endpoint issues no tokens) + status enum + `__Host-` cookies, ADR-014 self-service account deletion (cascade scope, irreversibility, what stays out of scope: data export, backup retention). `key_facts.md`: routes `/forgot-password`, `/reset-password`, `/verify-email`, `/accept-terms`, `/legal/[doc]`, `/legal/[doc]/[version]`, `/user/profile/manage-consent`, `/user/profile/delete-account`; cookie names per env; 3600s access token; `REGISTRATION_ENABLED` (now set in prod). `issues.md`: work-log entry 2026-09-30, amended 2026-10-01. `frontend/docs/auth/auth-flow.md`: cookie table, `user/layout.tsx` is the onboarding gate, sequences register→verify→explicit first login, re-consent (forced and self-service), login 403→resend, account deletion; same layout sentence in `frontend/CLAUDE.md`. Update the status table in the consent design doc; mark its backend-contract row "implemented in `backend/` (monorepo)" and do not create `docs/backend-contracts/consent-and-names.md`.
- Out of scope, recorded in ADR-014 consequences: cookie-consent banner / GA gating, data
  export (a downloadable copy of a user's data, distinct from deletion which Phase 5 now
  covers), name editing, backend-side registration gate, a breach-notification runbook as an
  operational (non-code) artifact.

## Wire contracts after Phase 5

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| `POST /auth/register` | `{email, password, first_name, last_name, consents:{terms, privacy}}` | `201 {detail}` no tokens | 409, 422, 429 (register throttle) |
| `POST /auth/login` | `{email, password}` | `200 TokenResponse` | 401; `403 {detail, code:"email_not_verified"}`; 429 (login throttle) |
| `POST /auth/verify-email` | `{token}` | `200 {detail}` no tokens; user then logs in | 400 invalid/used, 410 expired |
| `POST /auth/resend-verification` | `{email}` | `200 {detail}` always, constant-time across branches | 429 |
| `POST /auth/consent` (bearer) | `{terms?, privacy?}` ≥1 key | `200 UserResponse` | 401, 422 |
| `DELETE /auth/me` (bearer) | `{password}` | `204` no body, account and all owned data removed | 401 (unauthenticated or wrong password) |
| `GET /auth/me` | — | + `first_name`, `last_name`, `consents` (`{}` legacy), `status` (`active` when absent), `email_verified_at` | 401, 403 if status not in `SESSION_STATUSES` |

## Verification

```
make -C backend test && make -C backend lint
npm --prefix frontend test && npm --prefix frontend run build
npx --prefix frontend tsc --noEmit      # `npm run lint` is broken pre-existing (next lint removed in Next 16, issues.md 2026-09-30)
```
Manual against `make dev` (console adapter prints links in the API log):
1. `/user/register` with boxes unticked → field errors; typed values survive.
2. Ticked → "check your email" panel; API log shows the verify link. `/user/login` with that account → "verify your email" copy + link.
3. Open the link → Confirm → "Email confirmed" panel → sign in at `/user/login` → `/user/profile` shows "First Last" and two Agreements rows.
4. Reopen the link → dead-link panel; resend → new link works, old one 400s.
5. Add `terms/<tomorrow>.mdx` → next `/user/*` visit redirects to `/accept-terms`; accept → profile shows new version.
6. `/forgot-password` with a differently-cased email → reset link arrives and works.
7. DevTools: plain cookie names in dev; production build behind HTTPS shows `__Host-` names.
8. From the profile, open "Review / change consent" without any version bump pending →
   both documents show as already accepted → saving re-sends the same versions and the
   profile still shows them accepted (added 2026-10-01).
9. Hammer `/user/login` with a wrong password repeatedly → 429 after the threshold; same
   for repeated `/user/register` from one IP (added 2026-10-01).
10. From the profile, "Delete account" with the wrong password → rejected, account intact;
    with the right password + typed "DELETE" → account and its readings are gone from
    Mongo, session is logged out, redirected to `/` (added 2026-10-01).
11. Time two `/auth/resend-verification` calls, one for a pending account and one for an
    unknown email → response times should be comparable, not distinguishable (added
    2026-10-01).

## Risks

- Register with mail delivery failure: log and still 201 (account exists; resend covers recovery). Otherwise a 5xx leaves a half-created account that 409s on retry.
- Fixture ripple is wider than first thought: add `tests/auth/test_commands.py` and
  `tests/auth/test_queries.py` to the six HTTP-level files (found 2026-10-01 — both
  construct `RegisterUserHandler` directly and will break on the Phase 4 constructor change);
  all switch to `register_verify_and_login` in the same commit as the router change.
- `__Host-` deletion must be a `set` with `maxAge: 0` and `secure`; the unit test pins it.
- Turbopack is the project's actual default bundler (dev and prod, Next 16.1.6, confirmed
  2026-10-01), so the MDX static-registry fallback is the expected path, not a rare
  contingency — generate it from the directory listing at build time rather than
  hand-maintaining it, or the "add a file, edit nothing else" versioning promise breaks in
  practice.
- PII logs to fix while files are open: `request_password_reset.py:80`,
  `register/actions.ts:17`, `forgot-password/actions.ts:11`, `profile/actions.ts:58`, and
  (found 2026-10-01) `console_adapter.py` (logs the raw reset/verify link) and
  `resend_adapter.py` (logs the recipient email on every send) — fix both before Phase 4
  adds the verification-email send method.
- No rate limiting exists today on `/auth/login` or `/auth/register` (found 2026-10-01);
  Phase 4 adds it, or credential stuffing remains fully exposed after this work ships.
- Resend-verification's "always 200" design has a response-time side channel between the
  pending branch (DB write + synchronous email send) and the no-op branches (found
  2026-10-01); closed in Phase 4.
- Pending-account TTL purge vs. resend: see **Open point** below (resolved 2026-10-01 to key
  off a bumped `verification_deadline_at`, not `created_at`).
- Nothing in the original plan flips `REGISTRATION_ENABLED` on in the real prod compose/env
  file; Phase 6 now does it, not just documents the gap.

## GDPR and legal-content requirements

Not legal advice; the MDX texts in Phase 3 are drafts for review by a lawyer in the
operator's jurisdiction. This section records what the plan must satisfy so the drafts are
not written from memory.

### GDPR obligations mapped to the plan

| Obligation (GDPR art.) | How the plan meets it | Gap / decision needed |
|---|---|---|
| Lawful basis (6) | Account data (email, names, password hash, readings) is processed to perform the contract the user enters by accepting the Terms. Consent is **not** the basis for the Privacy Policy: the "I have read the Privacy Policy" checkbox is an acknowledgement of notice, and the Privacy text must say so rather than call it consent. | Wording of the second checkbox: "I have read and understood" not "I consent to". |
| Transparency / information (13) | Privacy Policy lists: controller identity and contact, data stored (email, names, password hash, readings, interpretations, usage ledger, consent records, verification/reset tokens), purpose per item, retention per item, recipients (Resend, the LLM provider, Google Analytics), rights and how to exercise them, complaint route to the supervisory authority. | Controller name, postal address and country are unknown to the repo; placeholders in the MDX until supplied. |
| Data minimisation (5.1c) | Names are collected because the user decided they are required. | Minimisation argues a tarot service does not need a legal name; keep the decision but the Privacy text must state the purpose (addressing the user, support correspondence). Reconsider if a reviewer objects. |
| Storage limitation (5.1e) | Verification and reset tokens expire via TTL indexes. Never-verified accounts: the pending-account TTL purge (open point above, resolved) is the retention mechanism. Active accounts: retention is "until the account is deleted", and deletion is now self-service (Phase 5). | Privacy text must state the pending-account TTL period and that deletion is immediate/self-service. |
| Right of access / erasure / portability (15, 17, 20) | **Updated 2026-10-01:** self-service `DELETE /auth/me` (Phase 5) covers erasure directly; access requests (a data export) still go through `POST /support/contact` with a stated 30-day response time. | Data export (a downloadable copy, not just deletion) remains out of scope; logged as a follow-up in ADR-014. |
| Proof of consent to terms (7.1) | `consents.{terms,privacy} = {version, accepted_at}` per user; every accepted version stays renderable at `/legal/<doc>/<date>`; re-consent gate on version change. | None. |
| Withdrawal / decline (7.3) | `/accept-terms` offers Log out for users who decline a new version; the self-service "Review / change consent" page (Phase 3, Feature 4) lets a user revisit consent at any time, not only on a version bump; declining either, or deleting the account (Phase 5), is not penalised beyond losing access to the service that requires it. | None. |
| Processors and transfers (28, 44–49) | Resend (email) and the LLM provider are named as processors; Google Analytics as a recipient. Both Resend and the LLM provider are US companies, so the Privacy text must cite the transfer mechanism (EU–US Data Privacy Framework participation or SCCs). | Confirm each provider's DPA/DPF status before publishing the text. |
| Cookies / ePrivacy | The three auth cookies are strictly necessary and exempt from consent; the Privacy text lists them by name, purpose and lifetime. `localStorage` UI preference likewise. | Google Analytics was removed on 2026-10-10; the site sets no non-essential cookies, so no banner is needed. |
| Children (8) | Terms require the user to be 18 or older; no age verification beyond the declaration. | None for now. |
| Security (32) | Argon2 password hashing, hashed one-time tokens, httpOnly `__Host-` cookies, no PII in logs, refresh-token rotation. | Breach-notification procedure is an operational document, not code; note the 72-hour duty in the Privacy text's internal notes only. |
| Automated decision-making (22) | Interpretations are AI-generated text with no legal or similarly significant effect on the user. The Terms say so. | None. |

### Terms and Conditions: required clauses for a tarot service

The Terms MDX (`src/content/legal/terms/2026-09-30.mdx`) must contain, in plain language:

1. **Nature of the service.** Tarot readings and interpretations are provided for
   entertainment only.
2. **Not a psychic, fortune-telling or divination service.** The service does not claim to
   predict the future or possess supernatural ability. Some
   jurisdictions regulate or prohibit fortune-telling for payment; this clause and the
   governing-law clause together are what keep the service outside those rules.
3. **Not therapy, counselling or professional advice.** Nothing on the service is medical,
   mental-health, psychological, legal, financial, or relationship advice, and it is not a
   substitute for a qualified professional. Users in crisis are directed to local emergency
   services or a crisis line (the text names a general international resource rather than a
   single national number).
4. **AI-generated content.** Interpretations are produced by a large language model; they
   may be inaccurate, inconsistent or inappropriate, and are not reviewed by a person before
   display.
5. **User responsibility.** Decisions the user makes after a reading are the user's own; the
   operator accepts no responsibility for actions taken in reliance on the service.
6. **Eligibility.** 18 years or older.
7. **Account.** Accurate registration details, one account per person, keep the password
   secret, verification by email required, accounts never verified may be deleted after the
   stated period.
8. **Acceptable use.** No harassment, no attempts to extract or abuse the AI, no scraping.
9. **Intellectual property.** Card imagery is the Rider-Waite deck (not the operator's own;
   corrected 2026-10-05); text, design and software belong to the operator or their licensors;
   the user's own readings remain theirs to export or delete.
10. **Availability and changes.** The service may change or stop; substantive changes to the
    Terms produce a new dated version that the user must accept to continue.
11. **Limitation of liability and disclaimer of warranties**, to the extent permitted by law.
12. **Governing law and venue.** Placeholder until the operator's jurisdiction is confirmed
    (repo signals point to the EU: Europe/Stockholm timezone, `.de` dev addresses).
13. **Contact.** The support address.

### Privacy Policy: required sections

Controller and contact · what we collect and why (table: data item, purpose, lawful basis,
retention) · cookies and local storage (table by name) · recipients and processors with
transfer mechanism · your rights and how to exercise them, including the supervisory
authority · security measures in plain words · children · changes to this policy
(dated versions, re-acknowledgement) · effective date equal to the MDX filename.

### Plan changes this implies

- Phase 3, Feature 1: the MDX drafts follow the two checklists above; the second checkbox
  label reads "I have read the Privacy Policy" while the first reads "I accept the Terms and
  Conditions".
- Phase 3, Feature 4: the Terms/Privacy text should mention that consent can be reviewed or
  changed any time from the profile, not only when a document version changes.
- Phase 4: the register "check your email" panel and the verification mail both mention the
  pending-account retention period (now tied to `verification_deadline_at`, see Open point).
- Phase 5: the Terms/Account section states that deletion is immediate and irreversible, and
  what it removes (readings, interpretations, usage ledger, consent/verification records).
- Phase 6: ADR-014 consequences list the GA cookie exposure, the still-manual data-export
  route, and the breach-notification runbook as accepted debts with follow-up items;
  `key_facts.md` records the controller contact placeholder that must be filled before
  launch.

## Open point: purge never-verified accounts

An unverified account is an email plus a password hash with no proven owner. Recommended:
a partial TTL index on `users` in migration 013, no job, no code path:

```python
await db[USERS_COLLECTION].create_index(
    [("created_at", ASCENDING)],
    expireAfterSeconds=7 * 24 * 3600,
    partialFilterExpression={"status": "pending_verification"},
    name="pending_users_ttl",
)
```

Active and legacy users (no `status` field) never match the filter; verifying flips the
document out of it. Verification tokens already expire via their own TTL index, and a
pending user has no refresh tokens. The grace period (7 vs 30 days) and whether to include
it at all are still to be decided; the Privacy Policy should state whichever retention is chosen.

**Resolved 2026-10-01:** resend must extend the purge clock, otherwise an actively-retrying
user near the TTL boundary can be silently deleted mid-verification with only a generic
"invalid token" error and no way to tell a purge from an expired link. Bumping
`users.created_at` forward on resend is wrong (breaks audit/creation semantics); instead add
`users.verification_deadline_at` (set at registration to `now + 7d`, bumped to `now + 7d` on
each successful resend) and key the TTL index off that field instead of `created_at`.
`verify_email` on a token whose user no longer exists returns the same 400 as "invalid
token" (no distinct "account purged" state — don't leak which case occurred). This is a
separate migration, `014_pending_users_ttl.py` (see Phase 4), not bundled with the
verification-token indexes in 013.

## Sequence: register → verify → explicit first login (Phase 4 as planned)

```
 Browser            RegisterForm/actions      FastAPI /auth/*            Mongo                 Email (Resend/console)
   │ submit form ──────────>│ zod registerSchema (email trim+lower, acceptTerms/acceptPrivacy = "on")
   │                        │ POST /register {email,password,first_name,last_name,
   │                        │   consents:{terms:v, privacy:v}}  v = CURRENT_VERSIONS (MDX filenames)
   │                        │ ────────────────────>│ find_by_email → 409?  │
   │                        │                      │ insert ──────────────>│  MODEL ① users: email (lowercased),
   │                        │                      │                       │   password_hash, first_name, last_name,
   │                        │                      │                       │   display_name "First Last",
   │                        │                      │                       │   status "pending_verification",
   │                        │                      │                       │   consents {terms:{version,accepted_at}, privacy:{…}}
   │                        │                      │ issue_verification_email: raw = generate_url_token()
   │                        │                      │  invalidate_all_for_user; store ─>│ MODEL ② email_verification_tokens:
   │                        │                      │                       │   {token_hash sha256(raw), user_id, used:false, expires_at now+24h}
   │                        │                      │  send_email_verification(to, FRONTEND_BASE_URL/verify-email?token=raw) ─>│
   │                        │                      │  (EmailDeliveryError → log user_id, still 201)
   │                        │<── 201 {detail} ─────│
   │<── "check your email" panel (no cookies, no redirect)
   │
   │ (login before verifying) POST /login ────────>│ verify_password FIRST, then assert_may_hold_session(pending) → 403
   │<── 403 {detail, code:"email_not_verified"} → login form shows link to /verify-email
   │
   │ GET /verify-email?token=raw (public, outside proxy matcher) → page renders Confirm button, nothing POSTed
   │ click Confirm ────────>│ POST /verify-email {token} ─>│ consume(sha256(raw)): None→400, expired→410
   │                        │                      │ update ──────────────>│  MODEL ③ users: status "active",
   │                        │                      │                       │   email_verified_at now, updated_at now;
   │                        │                      │ invalidate_all_for_user│  all verification tokens for user deleted
   │                        │<── 200 {detail} (NO tokens)
   │<── "Email confirmed. Enter the Sanctum" → link /user/login
   │
   │ POST /user/login ─────>│ POST /login ────────>│ verify_password ✓; assert_may_hold_session(active) ✓; tokens + refresh jti stored
   │                        │<── 200 TokenResponse │
   │                        │ applyAuthCookies(cookies(), tokens)
   │<── 302 /user/profile + Set-Cookie ×3 (httpOnly, lax, path=/, __Host- prefix in prod)
   │ GET /user/profile ────>│ user/layout: getCurrentUser → GET /me (get_current_user dep re-asserts status)
   │                        │<── MeResponse {first_name,last_name,status,email_verified_at,consents}
   │                        │ onboardingRedirect(user, CURRENT_VERSIONS) → null → render
```

Resend: `POST /resend-verification {email}` → throttle `record_attempt("verify:<email>")` before lookup (429 over max) → unknown or active user = no-op → pending user gets a fresh MODEL ② row and a new mail → always 200.

Payment step later: enum gains `payment_required`; backend `SESSION_STATUSES` adds it (they must log in to pay) and `assert_may_hold_session` stays the single check on login/refresh/`get_current_user`; frontend `onboardingRedirect` gains one branch → `/user/billing`; `requireConsentedUser()` already blocks data-creating actions for any non-null redirect.

Consent sequences (register with consents, re-consent on a bumped version) are unchanged from `frontend/docs/gdpr-consent-terms-and-named-registration.md`.
