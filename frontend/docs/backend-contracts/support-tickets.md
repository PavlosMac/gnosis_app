# Backend Contract — Support Tickets via Email Relay

**Status:** spec — to be implemented in the `gnosis-esoterica-api` repo (this repo never edits the backend; this document is the contract handed to a backend session).

**Date:** 2026-09-15

## Decision summary (see ADR-010)

A logged-in user's support request (subject + message) is relayed to the site owner as an email through the ADR-009 `send_email()` module (see `email-service.md`) — no ticket storage, no third-party helpdesk. The backend, never the frontend, attaches the requesting user's identity (email + user_id) from the JWT, so tickets are always attributable and cannot be forged. `reply_to` is set to the user's email so a plain inbox Reply reaches them directly.

## 1. Endpoint

`POST /api/v1/support/contact` — **auth required** (standard bearer JWT).

Request body:

```json
{
  "subject": "<string, trimmed, 3–200 chars>",
  "message": "<string, trimmed, 10–5000 chars>"
}
```

- Limits mirror the frontend's `contactSupportSchema` (`src/lib/validation/support-schemas.ts`, `SUPPORT_SUBJECT_MAX = 200`, `SUPPORT_MESSAGE_MAX = 5000`) — keep the two in sync; the frontend has a test pinning these values to this document.
- The backend MUST ignore any identity fields in the body and resolve `email` + `user_id` from the authenticated user only.

Responses:

| Status | Meaning | Body |
|---|---|---|
| 200 | Sent | `{"message": "Your message has been received."}` |
| 401 | Unauthenticated | standard |
| 422 | Limit violations | standard (should be unreachable — zod validates first) |
| 429 | Rate-limited | standard — frontend maps it to "Too many requests. Please wait and try again." |
| 5xx | `send_email()` failed | standard — do **not** return a fake 200: unlike forgot-password there is no enumeration concern, and the user must know the message did not go through |

## 2. Backend configuration

One new environment variable:

```
SUPPORT_EMAIL=<destination inbox>
```

E.g. `support@tarotdivinations.com` (routed to Gmail via a Cloudflare Email Routing rule) or the Gmail address directly. Do not overload `EMAIL_FROM` — that is the From identity, not a destination.

## 3. Email composition

Extend the ADR-009 module signature with an optional reply-to:

```python
async def send_email(
    to: str, subject: str, html: str, text: str | None = None,
    reply_to: str | None = None,
) -> str: ...
```

Then:

```python
await send_email(
    to=SUPPORT_EMAIL,
    subject=f"[Support] {subject}",
    html=...,  # message verbatim (HTML-escaped) + metadata block
    text=...,
    reply_to=user.email,
)
```

- Body: the user's message (HTML-escaped), followed by a metadata block: user email, user_id, timestamp — enough to look the account up quickly.
- **Why `reply_to` and not From:** From must stay `EMAIL_FROM` (`noreply@tarotdivinations.com`) so DKIM `d=` stays aligned with the From domain — putting the user's address in From would fail DMARC at the receiving end. `reply_to` gives the same one-click reply with zero extra infrastructure (anticipated in `email-service.md` §5).

## 4. Consumer (frontend — already shipped)

The profile page's Contact Support modal (`src/app/user/profile/ContactSupportModal.tsx`) submits via the `contactSupport` server action (`src/app/user/profile/actions.ts`), which POSTs `{subject, message}` through `authenticatedFetch` after zod validation. The frontend reads the 200 body as `MessageResponse` but only checks `ok`; error statuses render via `SAFE_MESSAGES` in `src/lib/api-client.ts`.

## 5. Notes

- Rate-limit per user: suggest **5 requests/hour**. This endpoint sends email on demand — an abuse/spam-relay vector, same reasoning as the forgot-password limit.
- The Resend free-tier ceiling (100/day) is shared with password resets; the rate limit keeps support traffic well under it.

## Verification

1. Authenticated `curl` POST → 200; email arrives at `SUPPORT_EMAIL` with subject `[Support] ...`, the metadata block, and `Reply-To:` set to the test user's address.
2. Reply from the inbox → lands at the test user's email.
3. Unauthenticated POST → 401.
4. 6th request within the hour → 429.
5. Frontend end-to-end: submit the profile modal on the deployed site → confirmation panel shown, email arrives.
