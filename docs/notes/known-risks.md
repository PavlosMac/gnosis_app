# Known Risks

Accepted or unmitigated risks in shipped code, one line each. When one is fixed, move it
to Resolved with the date. Bugs with a known cause go in [`bugs.md`](bugs.md) instead.

## Open

- Pre-hijacking: someone can register another person's email with their own password. If the owner clicks the confirmation link, the account activates with that password.
- Spoofable address off Cloudflare: where the frontend is reachable without Cloudflare, a caller can send its own forwarded address and dodge the rate limits.
- Duplicated figures: the 24-hour and 7-day wording in the UI mirrors backend settings by hand.

## Resolved

- Support behind the gate: a user with stale consent cannot open a support ticket, which is also the route for data-access requests. — RESOLVED 2026-10-10: support needs only a session, and /accept-terms links to it.
- Google Analytics: it still loads without cookie consent, as the plan accepted. — RESOLVED 2026-10-10: GA removed entirely.
