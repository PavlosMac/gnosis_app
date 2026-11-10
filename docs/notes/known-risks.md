# Known Risks

Accepted or unmitigated risks in shipped code, one line each. When one is fixed, move it
to Resolved with the date. Bugs with a known cause go in [`bugs.md`](bugs.md) instead.

## Open

- Pre-hijacking: someone can register another person's email with their own password. If the owner clicks the confirmation link, the account activates with that password.
- Spoofable address off Cloudflare: where the frontend is reachable without Cloudflare, a caller can send its own forwarded address and dodge the rate limits.
- Duplicated figures: the 24-hour and 7-day wording in the UI mirrors backend settings by hand.
- Open redirect after login: `isSafeReturnPath` accepts `/\evil.com`, which browsers resolve to `https://evil.com/`; a crafted login link can hop off-site once the user signs in. See [`security-watchlist.md`](security-watchlist.md) F3.
- Backend dependency backlog (2026-11-05): `certifi` ships a compromised root chain; starlette, PyJWT, pymongo, pydantic-settings, urllib3, anyio behind with low direct exposure. Fix versions and triage in [`security-watchlist.md`](security-watchlist.md) §3.
- No birth date for existing accounts: legacy, seeded and pre-2026-11-03 invited users cannot set one (no profile or admin path), so they keep the empty card-of-the-day frame, and the 18+ check applies only to new sign-ups.

## Resolved

- Support behind the gate: a user with stale consent cannot open a support ticket, which is also the route for data-access requests. — RESOLVED 2026-10-10: support needs only a session, and /accept-terms links to it.
- Google Analytics: it still loads without cookie consent, as the plan accepted. — RESOLVED 2026-10-10: GA removed entirely.
- Frontend dependency backlog (2026-11-05): Next.js ~40 advisories behind and an end-of-life Node 20 image. — RESOLVED 2026-11-10: Next 16.4.6, Node 24 image (arm64 build verified locally; not yet deployed).
