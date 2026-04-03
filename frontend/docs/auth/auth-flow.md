# Authentication Flow

## Overview

JWT authentication via an external FastAPI backend. Tokens are stored in httpOnly cookies and never exposed to client JavaScript. The Next.js middleware (proxy) handles route guarding and token refresh; server actions handle login/register/logout.

## Key Files

| File | Role |
|------|------|
| `src/proxy.ts` | Middleware — route guard, token refresh (proactive + expired) |
| `src/lib/api-client.ts` | `authenticatedFetch()`, `publicFetch()`, cookie helpers |
| `src/lib/session.ts` | `getCurrentUser()` — cached user fetch for server components |
| `src/app/user/layout.tsx` | Server layout — fetches user, passes to AuthProvider |
| `src/app/providers/auth-provider.tsx` | React context — `useAuth()` hook |
| `src/app/user/login/actions.ts` | Login server action |
| `src/app/user/register/actions.ts` | Register server action |
| `src/app/user/logout/actions.ts` | Logout server action |
| `src/lib/validation/auth-schemas.ts` | Zod schemas for login/register |
| `src/types/auth.ts` | User, TokenResponse, form state types |

## Cookies

| Cookie | Purpose | Flags |
|--------|---------|-------|
| `access_token` | JWT for API calls | httpOnly, secure (prod), sameSite=lax |
| `refresh_token` | Single-use token for refresh | httpOnly, secure (prod), sameSite=lax |
| `token_expires_at` | Unix timestamp — access token expiry | httpOnly, secure (prod), sameSite=lax |

## Token Lifetimes

- **Access token:** 60 minutes
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
