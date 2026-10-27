# Authentication Flow

## Overview

JWT authentication via an external FastAPI backend. Tokens are stored in httpOnly cookies and never exposed to client JavaScript. The Next.js middleware (proxy) handles route guarding and token refresh; server actions handle login/register/logout.

## Key Files

| File | Role |
|------|------|
| `src/proxy.ts` | Middleware — route guard, token refresh (proactive + expired). Guards `/user/*`, `/superadmin/*` and `/accept-terms`; the root pages (`/`, `/reading`, `/significators`, `/about`, `/guide`, `/legal`) are public |
| `src/lib/api-client.ts` | `authenticatedFetch()`, `publicFetch()` (forwards the browser IP, surfaces the backend error `code`), cookie wrappers |
| `src/lib/auth-cookies.ts` | The only reader/writer of the three session cookies (edge-safe; used by the proxy and by server actions) |
| `src/lib/session.ts` | `getCurrentUser()` — cached user fetch; `requireConsentedUser()` — the same, but null while onboarding is outstanding |
| `src/lib/onboarding.ts` | `onboardingRedirect()` — the single decision of where a logged-in user must go first |
| `src/app/layout.tsx` | Root server layout — fetches the user and the `REGISTRATION_ENABLED` flag, passes both to `AuthProvider` |
| `src/app/user/layout.tsx` | The onboarding gate for `/user/*`: redirects a logged-in user to `/accept-terms` (or `/verify-email`) when something is outstanding. Does not fetch for `AuthProvider` — the root layout does |
| `src/app/verify-email/` | Email confirmation page, Confirm and resend actions (public) |
| `src/app/accept-invite/` | Accept a superadmin invite: names, password, consents against the emailed token (public, app root, not gated by `REGISTRATION_ENABLED`) |
| `src/app/superadmin/` | The admin page: user list, invite form, email and delete modals; every action re-checks `isSuperadmin` |
| `src/app/accept-terms/` | Re-consent interstitial and action |
| `src/app/user/profile/settings/` | Account settings: contact support, the Agreements rows (each opens the accepted version in `LegalDocumentModal`, rendered on demand by the `loadAgreementDocument` server action so the page ships no legal text), one-click password reset, link to deletion. The agreements and delete pages' back buttons return here |
| `src/app/user/profile/manage-consent/`, `delete-account/` | Self-service consent and account deletion |
| `src/app/providers/auth-provider.tsx` | React context — `useAuth()` hook |
| `src/app/user/login/actions.ts` | Login server action |
| `src/app/user/register/actions.ts` | Register server action |
| `src/app/user/logout/actions.ts` | Logout server action |
| `src/app/forgot-password/actions.ts` | Forgot-password server action (public) |
| `src/app/reset-password/actions.ts` | Reset-password server action (public) |
| `src/lib/validation/auth-schemas.ts` | Zod schemas for login/register/accept-invite/forgot/reset |
| `src/lib/validation/admin-schemas.ts` | Zod schemas for the superadmin actions (invite, email a user, delete a user) |
| `src/types/auth.ts` | User, TokenResponse, form state types |

## Cookies

| Cookie | Purpose | Flags |
|--------|---------|-------|
| `access_token` | JWT for API calls | httpOnly, secure (prod), sameSite=lax |
| `refresh_token` | Single-use token for refresh | httpOnly, secure (prod), sameSite=lax |
| `token_expires_at` | Unix timestamp — access token expiry | httpOnly, secure (prod), sameSite=lax |

In production (`NODE_ENV=production`) each name carries the `__Host-` prefix
(`__Host-access_token`, …), which binds the cookie to this exact host over HTTPS: Secure,
Path=/ and no Domain are mandatory. The diagrams below use the plain dev names.

All three are written, read and cleared only through `src/lib/auth-cookies.ts`
(`applyAuthCookies`, `readAuthCookies`, `clearAuthCookies`). Clearing is a `set` with
`maxAge: 0` and the same options, never `delete`: browsers drop the deletion of a
`__Host-` cookie that lacks Secure.

## Token Lifetimes

- **Access token:** 60 minutes (backend `JWT_ACCESS_TOKEN_EXPIRE_SECONDS=3600`), but only while its session lives: logout, password reset, account deletion and refresh replay end it at once, and the next call answers 401 (`authenticatedFetch` then tries a refresh, which fails, and the user is sent to login)
- **Refresh token:** longer-lived (backend-controlled)
- **Proactive refresh threshold:** 10 seconds (refresh when <10s remain)

## Sequence Diagrams

### 1. Login

```
  Browser                 Next.js Server              FastAPI
    |                         |                          |
    |  POST /user/login       |                          |
    |  (form submit)          |                          |
    |------------------------>|                          |
    |                         |  Zod validation          |
    |                         |  (loginSchema)           |
    |                         |                          |
    |                         |  publicFetch POST        |
    |                         |  /api/v1/auth/login      |
    |                         |------------------------->|
    |                         |                          |
    |                         |  200 { access_token,     |
    |                         |    refresh_token,        |
    |                         |    access_token_expires_at,
    |                         |    refresh_token_expires_at }
    |                         |<-------------------------|
    |                         |                          |
    |                         |  setAuthCookies()        |
    |                         |  (3 httpOnly cookies)    |
    |                         |                          |
    |  302 /user/profile      |                          |
    |  Set-Cookie: access_token, refresh_token, token_expires_at
    |<------------------------|                          |
```

### 2. Authenticated Page Load (token valid)

```
  Browser                 Middleware (proxy.ts)     Server Component        FastAPI
    |                         |                         |                     |
    |  GET /user/profile      |                         |                     |
    |------------------------>|                         |                     |
    |                         |  Read cookies           |                     |
    |                         |  access_token: present  |                     |
    |                         |  secondsRemaining: 45   |                     |
    |                         |  (> 10s threshold)      |                     |
    |                         |                         |                     |
    |                         |  NextResponse.next()    |                     |
    |                         |------------------------>|                     |
    |                         |                         |                     |
    |                         |    UserLayout:          |                     |
    |                         |    getCurrentUser()     |                     |
    |                         |                         |                     |
    |                         |    authenticatedFetch   |                     |
    |                         |    GET /api/v1/auth/me  |                     |
    |                         |                         |-------------------->|
    |                         |                         |                     |
    |                         |                         |  200 { user data }  |
    |                         |                         |<--------------------|
    |                         |                         |                     |
    |                         |    AuthProvider          |                     |
    |                         |    initialUser={user}   |                     |
    |                         |                         |                     |
    |  200 HTML               |                         |                     |
    |<--------------------------------------------------------|              |
```

### 3. Proactive Token Refresh (< 10s remaining)

```
  Browser                 Middleware (proxy.ts)                    FastAPI
    |                         |                                      |
    |  GET /user/profile      |                                      |
    |------------------------>|                                      |
    |                         |  Read cookies                        |
    |                         |  access_token: present               |
    |                         |  secondsRemaining: 8                 |
    |                         |  (< 10s threshold)                   |
    |                         |                                      |
    |                         |  POST /api/v1/auth/refresh           |
    |                         |  { refresh_token: "..." }            |
    |                         |------------------------------------->|
    |                         |                                      |
    |                         |  200 { new access_token,             |
    |                         |    new refresh_token,                |
    |                         |    access_token_expires_at,          |
    |                         |    refresh_token_expires_at }        |
    |                         |<-------------------------------------|
    |                         |                                      |
    |                         |  setCookiesFromTokenResponse()       |
    |                         |  (update all 3 cookies)              |
    |                         |                                      |
    |  200 HTML + Set-Cookie  |                                      |
    |  (new tokens)           |                                      |
    |<------------------------|                                      |
```

### 4. Expired Access Token (refresh token still valid)

```
  Browser                 Middleware (proxy.ts)                    FastAPI
    |                         |                                      |
    |  GET /user/profile      |                                      |
    |------------------------>|                                      |
    |                         |  Read cookies                        |
    |                         |  access_token: MISSING (expired)     |
    |                         |  refresh_token: present              |
    |                         |                                      |
    |                         |  POST /api/v1/auth/refresh           |
    |                         |  { refresh_token: "..." }            |
    |                         |------------------------------------->|
    |                         |                                      |
    |                         |  200 { new tokens }                  |
    |                         |<-------------------------------------|
    |                         |                                      |
    |                         |  setCookiesFromTokenResponse()       |
    |                         |  NextResponse.next()                 |
    |                         |                                      |
    |  200 HTML + Set-Cookie  |                                      |
    |<------------------------|                                      |
```

### 5. Both Tokens Expired / Refresh Fails

```
  Browser                 Middleware (proxy.ts)                    FastAPI
    |                         |                                      |
    |  GET /user/profile      |                                      |
    |------------------------>|                                      |
    |                         |  Read cookies                        |
    |                         |  access_token: MISSING               |
    |                         |  refresh_token: present (but stale)  |
    |                         |                                      |
    |                         |  POST /api/v1/auth/refresh           |
    |                         |------------------------------------->|
    |                         |                                      |
    |                         |  401 (refresh token revoked/expired) |
    |                         |<-------------------------------------|
    |                         |                                      |
    |                         |  Clear all auth cookies              |
    |                         |                                      |
    |  302 /user/login?from=/user/profile                            |
    |<------------------------|                                      |
```

### 6. No Tokens at All

```
  Browser                 Middleware (proxy.ts)
    |                         |
    |  GET /user/profile      |
    |------------------------>|
    |                         |  Read cookies
    |                         |  access_token: MISSING
    |                         |  refresh_token: MISSING
    |                         |
    |  302 /user/login?from=/user/profile
    |<------------------------|
```

### 7. Logout

```
  Browser                 Next.js Server              FastAPI
    |                         |                          |
    |  logout() server action |                          |
    |------------------------>|                          |
    |                         |  authenticatedFetch      |
    |                         |  POST /api/v1/auth/logout|
    |                         |------------------------->|
    |                         |                          |
    |                         |  200 (best-effort)       |
    |                         |<-------------------------|
    |                         |                          |
    |                         |  clearAuthCookies()      |
    |                         |                          |
    |  302 /user/login        |                          |
    |<------------------------|                          |
```

### 8. Forgot Password

Public pages at root level (`/forgot-password`, `/reset-password`) — outside the
proxy matcher (`/user/*`, `/superadmin/*`), so no guard changes and they work
logged-in or logged-out. Also reachable one-click from the profile dashboard
("Renew the Seal"), where the email comes from the server-side session
(`requestPasswordResetForCurrentUser` in `src/app/user/profile/actions.ts`).

```
  Browser                 Next.js Server              FastAPI
    |                         |                          |
    |  POST /forgot-password  |                          |
    |  (form submit, email)   |                          |
    |------------------------>|                          |
    |                         |  Zod validation          |
    |                         |  (forgotPasswordSchema)  |
    |                         |                          |
    |                         |  publicFetch POST        |
    |                         |  /api/v1/auth/forgot-password
    |                         |------------------------->|
    |                         |                          |
    |                         |  200 { message }         |
    |                         |  (ALWAYS 200 — never     |
    |                         |   reveals whether the    |
    |                         |   account exists)        |
    |                         |<-------------------------|
    |                         |                          |
    |  Generic confirmation   |                          |
    |  ("If an account exists...")                       |
    |<------------------------|                          |
```

Only error state: **429** (rate-limited) → "Too many requests" copy. The
backend emails a link to `{FRONTEND_BASE_URL}/reset-password?token=...`
(30-minute TTL) — `FRONTEND_BASE_URL` must be the real frontend origin in prod
(defaults to `http://localhost:3000`).

### 9. Reset Password

```
  Browser                 Next.js Server              FastAPI
    |                         |                          |
    |  GET /reset-password?token=...                     |
    |  (emailed link; no token → dead-link panel,        |
    |   nothing is ever POSTed)|                          |
    |------------------------>|                          |
    |  form (new password + confirm, token hidden input) |
    |<------------------------|                          |
    |                         |                          |
    |  POST (form submit)     |                          |
    |------------------------>|                          |
    |                         |  Zod validation          |
    |                         |  (resetPasswordSchema,   |
    |                         |   password 8-128)        |
    |                         |                          |
    |                         |  publicFetch POST        |
    |                         |  /api/v1/auth/reset-password
    |                         |  { token, new_password } |
    |                         |------------------------->|
    |                         |                          |
    |                         |  200 — backend revokes   |
    |                         |  ALL refresh tokens,     |
    |                         |  issues nothing new      |
    |                         |  400 — token invalid/used|
    |                         |  410 — token expired     |
    |                         |<-------------------------|
    |                         |                          |
    |                         |  on 200:                 |
    |                         |  clearAuthCookies()      |
    |                         |                          |
    |  Success panel + link to /user/login               |
    |  (400/410: dead-link panel + /forgot-password link)|
    |<------------------------|                          |
```

After a successful reset the user signs in again with the new password. Any
other open tab's next refresh call 401s (all refresh tokens revoked), so the
existing "refresh failed → logout" middleware path (diagram 5) cleans it up.

### 10. Register → Verify → Explicit First Login

```
Browser            Next.js actions              FastAPI                    Email
  | submit form  ---> register()                                              |
  |   firstName, lastName, email, password,                                   |
  |   acceptTerms, acceptPrivacy                                              |
  |                  zod registerSchema (boxes must be "on")                  |
  |                  POST /auth/register {email, password, first_name,        |
  |                    last_name, consents: CURRENT_VERSIONS}  ------------>  |
  |                                          user created, status             |
  |                                          pending_verification  ---------> | link
  |                  <-- 201 {detail}  (no tokens)                            |
  | <-- "Check your email" panel (no cookies, no redirect)                    |
  |                                                                           |
  | login before confirming ---> POST /auth/login                             |
  |                  <-- 403 {code: "email_not_verified"}                     |
  | <-- "Please confirm your email" + link to /verify-email                   |
  |                                                                           |
  | GET /verify-email?token=...   (renders a Confirm button; nothing posted)  |
  | click Confirm ---> verifyEmail()  POST /auth/verify-email {token}         |
  |                  <-- 200 {detail}  (no tokens)   400 invalid / 410 expired|
  | <-- "Email confirmed" + link to /user/login                               |
  |                                                                           |
  | POST /user/login ---> login() ---> 200 TokenResponse ---> Set-Cookie x3   |
  | <-- 303 /user/profile                                                     |
```

`/verify-email` without a token, or after a 400/410, shows the resend form
(`POST /auth/resend-verification`, always 200). Registration needs
`REGISTRATION_ENABLED=true`; otherwise the proxy redirects `/user/register` to login.

### 11. Re-consent (forced and self-service)

```
GET /user/*  --->  user/layout.tsx: getCurrentUser()
                   onboardingRedirect(user, CURRENT_VERSIONS)
                     stale Terms or Privacy  --->  redirect /accept-terms
/accept-terms: lists only the stale documents, one checkbox each
  Continue ---> acceptTerms() ---> POST /auth/consent {terms?: version, privacy?: version}
           ---> redirect /user/profile
  Log out, or "Delete my account" (the delete page is exempt from the gate)
```

`CURRENT_VERSIONS` is the newest dated file of each document
(`src/content/legal/<doc>/<date>.mdx`). The same endpoint backs
`/user/profile/manage-consent`, where a user can re-record acceptance at any time.
Layouts do not protect server actions: `createReading`, `generateInterpretation`,
`updateReadingTags` and `contactSupport` call `requireConsentedUser()` and answer with
their not-authenticated shape while consent is stale.

### 12. Account Deletion

```
/user/profile/delete-account: password + typed "DELETE"
  deleteAccount() ---> zod deleteAccountSchema
                  ---> DELETE /auth/me {password}
                         403 {code: "invalid_password"}  ---> field error, nothing deleted
                         204  ---> clearAuthCookies() ---> redirect /
```

### 13. Invite → Accept → Explicit First Login

```
Superadmin /superadmin        Next.js actions            FastAPI                      Invitee
  Invite a seeker {email} ---> inviteUser()  (isSuperadmin re-checked)
                               POST /users/invite  ------>  invited user + link  -----> email
                               <-- 200 | 409 exists | 502 mail failed
  <-- row "Invited" (revalidatePath)
                                                                                         opens /accept-invite?token=...
                               page: publicFetch GET /auth/invite?token=  (peek only)
                                 200 {email} -> form with "Invitation for <email>"
                                 400 / 410   -> dead-link panel, no form
                                                                                         submit names, password, consents
                               acceptInvite()  zod acceptInviteSchema (no email field)
                               POST /auth/accept-invite {token, password, first_name,
                                 last_name, consents: CURRENT_VERSIONS}
                                 <-- 200 (no tokens) | 400 / 410 dead link
                                     | 422 weak_password -> field error, link still usable
                                                                                         <-- "Your account is ready" -> /user/login
```

The page lives at the app root, so neither the proxy's `/user/register` gate nor the
onboarding gate applies, and `REGISTRATION_ENABLED` is never read: prod keeps sign-up
closed while the admin invites. Details and the backend side:
[`../admin/user-management.md`](../admin/user-management.md).

### 14. Superadmin Email and Delete

```
/superadmin row  Email  ---> EmailUserModal  ---> emailUser()  POST /users/{id}/email {subject, message}
                                                     <-- 200 | 404 gone | 502 mail failed
/superadmin row  Delete ---> DeleteUserModal (type DELETE) ---> deleteUser()
                                                     own id -> refused before the API
                                                     DELETE /users/{id}  <-- 204 | 404 | 409 self
                              modal closes, row gone (revalidatePath)
```

## Lessons Learned

### process.env in Middleware

`process.env.GNOSIS_API_BASE_URL` must be read lazily (via a getter function) in middleware context. Evaluating it at module load can yield `undefined` because middleware runs in a different runtime than server actions. Both `proxy.ts` and `api-client.ts` use the same pattern:

```typescript
const GNOSIS_API_BASE_URL = () => {
  const url = process.env.GNOSIS_API_BASE_URL;
  if (!url) throw new Error("GNOSIS_API_BASE_URL environment variable is not set");
  return url;
};
```

### Proactive Refresh Threshold

The threshold must be well below the access token lifetime. With 60-minute tokens:
- **Bad:** `120s` — triggers on every request, burns single-use refresh tokens
- **Good:** `10s` — only fires in the final moments before expiry

### Refresh Tokens Are Single-Use

The FastAPI backend rotates refresh tokens on each use. If a proactive refresh fires too eagerly and succeeds, the old refresh token is immediately revoked. Any subsequent request still carrying the old refresh token will fail.
