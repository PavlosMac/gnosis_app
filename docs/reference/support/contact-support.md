# Contact Support

**Status: Live** (backend and frontend shipped 2026-09-15 to 2026-09-21; ADR-010 in
[`../../notes/decisions.md`](../../notes/decisions.md)). A logged-in user's support request is
relayed to the site owner as an email. No ticket storage, no helpdesk product.

This page is the **contract between the two sides**: the endpoint shape and the limits both
validate. The backend internals (throttle, templates, why `Reply-To` and not `From`) are in
[`../email/email-service.md`](../email/email-service.md) under "The support contact flow".

## Endpoint

`POST /api/v1/support/contact` — **auth required** (bearer JWT; identity is taken from the
token, never from the body). Router: `backend/src/support/router.py`.

```json
{ "subject": "<string, trimmed, 3–200 chars>", "message": "<string, trimmed, 10–5000 chars>" }
```

| Status | Meaning | Body |
|---|---|---|
| 200 | Relayed | `{"message": "Your message has been received."}` |
| 401 | Unauthenticated | standard |
| 422 | Limit violations | standard (unreachable in practice: zod validates first) |
| 429 | Over the per-user rate limit (`SUPPORT_CONTACT_RATE_LIMIT_*`, default 5 per hour) | standard; frontend shows "Too many requests. Please wait and try again." |
| 502 | Email provider failed | standard; the user must know the message did not go through |
| 503 | `SUPPORT_EMAIL` unset | standard |

## Limits are pinned on both sides

| Side | Where | Values |
|---|---|---|
| Backend | `backend/src/support/schemas.py` | `SUPPORT_SUBJECT_MAX = 200`, `SUPPORT_MESSAGE_MAX = 5000`, minimums 3 / 10 |
| Frontend | `frontend/src/lib/validation/support-schemas.ts` | same constants; `frontend/src/lib/__tests__/support-schemas.test.ts` pins them to this doc |

Change all three together.

## Frontend

- Entry point: the "Contact support" row on `/user/profile/settings` (`AccountSettingsCard`), reached from the profile's "Account settings" row; the Agreements rows sit under it
  (`frontend/src/app/user/profile/ContactSupportRow.tsx`) opens `ContactSupportModal.tsx`
  (subject + message, zod-validated, confirmation panel on success).
- Submission: the `contactSupport` server action (`frontend/src/app/user/profile/actions.ts`)
  POSTs through `authenticatedFetch`. Error statuses map to copy via `SAFE_MESSAGES` in
  `frontend/src/lib/api-client.ts`.
- Support needs only a session, not current consent, so a user whose consent is stale can
  still reach it from `/accept-terms` (that page links to it). This is also the route for
  data-access requests.

## Configuration

`SUPPORT_EMAIL` is the destination inbox (not the From identity). Rate limit:
`SUPPORT_CONTACT_RATE_LIMIT_WINDOW_SECONDS` (3600) and
`SUPPORT_CONTACT_RATE_LIMIT_MAX_ATTEMPTS` (5). All in `backend/src/core/config.py`.
