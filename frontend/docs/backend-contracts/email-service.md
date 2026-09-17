# Backend Contract — Transactional Email via Resend

**Status:** spec — to be implemented in the `gnosis-esoterica-api` repo (this repo never edits the backend; this document is the contract handed to a backend session).

**Date:** 2026-09-15

## Decision summary (see ADR-009)

All transactional email is sent by the FastAPI backend through [Resend](https://resend.com) (free tier: 3,000 emails/month, 100/day — ample). The frontend never holds a mail API key and never talks to Resend. The domain is `tarotdivinations.com`, DNS on Cloudflare, which also runs Cloudflare Email Routing for inbound mail — the Resend records below coexist with it.

## 1. Resend account + DNS (one-time, manual)

1. Create a Resend account (free, no card) and an API key.
2. In Resend, add the domain **`tarotdivinations.com`** (the apex — not a subdomain).
3. Add the records Resend displays into Cloudflare DNS (DNS-only, not proxied):
   - **DKIM**: TXT at `resend._domainkey.tarotdivinations.com`
   - **SPF + MX** at `send.tarotdivinations.com` (Resend's return-path subdomain)
4. Wait for the domain to show **Verified** in the Resend dashboard.

Why this coexists with Cloudflare Email Routing: Email Routing owns the **apex** MX + SPF (`include:_spf.mx.cloudflare.net`); Resend's SPF/MX live on the `send.` subdomain and its DKIM on `resend._domainkey.` — no shared records, inbound forwarding to Gmail is untouched. DKIM signs `d=tarotdivinations.com`, which aligns with the From domain, so a future DMARC record passes with no extra work.

## 2. Backend configuration

New environment variables (compose/env on the Pi):

```
RESEND_API_KEY=<secret, backend only>
EMAIL_FROM="Tarot Divinations <noreply@tarotdivinations.com>"
```

`FRONTEND_BASE_URL` (already required by the password-reset flow) is the base for any links embedded in emails.

## 3. Email module

One internal function; nothing else in the backend talks to Resend:

```python
async def send_email(to: str, subject: str, html: str, text: str | None = None) -> str:
    """Send via Resend; returns the Resend message id. Raises EmailSendError on failure."""
```

- Implementation: the `resend` Python SDK, or a plain `POST https://api.resend.com/emails` with `Authorization: Bearer {RESEND_API_KEY}` and `{from, to, subject, html, text}`.
- Log the returned message id; on failure raise a typed error so each caller decides user-facing behavior (e.g. forgot-password must still return its generic 200).

## 4. Consumers

### 4.1 Password reset (first real consumer — frontend already live)

The frontend shipped `/forgot-password` and `/reset-password` on 2026-09-14 expecting:

- `POST /api/v1/auth/forgot-password` sends the reset email via `send_email()`. The link **must** target `{FRONTEND_BASE_URL}/reset-password?token=...` (route path is part of the existing contract). Always return the generic 200; rate-limit with 429 (the frontend maps 429 to its rate-limit copy).
- Email content: keep it simple — subject "Reset your Tarot Divinations password", a short paragraph, the link, and an "ignore this if you didn't request it" line. Plain HTML + text part.

### 4.2 Smoke test (superadmin)

`POST /api/v1/admin/email/test` with body `{"to": "<address>"}` → sends a fixed test email, returns `{"id": "<resend message id>"}`. Superadmin-only, with the role check inside the endpoint itself (server actions/endpoints are never protected by layouts — same rule as the frontend's CLAUDE.md).

## 5. Notes

- Replies to `noreply@` go nowhere by default. If replies should reach the owner, either add a Cloudflare Email Routing rule (or catch-all) forwarding `noreply@tarotdivinations.com` to Gmail, or set `reply_to` on outgoing messages.
- Free-tier ceiling is 100 emails/day — no per-feature budgeting needed at current scale, but the forgot-password endpoint should keep its own rate limit regardless (abuse vector).
- Frontend error mapping already in place: 429 → "Too many requests. Please wait and try again." in `src/lib/api-client.ts` `SAFE_MESSAGES`.

## Verification

1. Resend dashboard: domain `tarotdivinations.com` shows **Verified**.
2. Smoke test: `POST /api/v1/admin/email/test` as superadmin → email arrives (not spam), message visible in Resend's log.
3. End-to-end: submit `/forgot-password` on the deployed frontend → email arrives, link opens `/reset-password?token=...`, reset succeeds.
4. Inbound regression check: mail to the existing Cloudflare Email Routing address still forwards to Gmail.
