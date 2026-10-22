# Architectural Decisions

This file logs architectural decisions (ADRs) for the whole monorepo (backend and frontend). Use bullet lists for clarity.

Older entries cite plan documents by their path at the time. Plans are deleted once they ship (see `docs/README.md`), so those paths may no longer exist; `git log --all -- <path>` recovers them. Paths from before the 2026-09-17 monorepo merge (`gnosis-esoterica-api/...`, `tarot-divinations/...`) map to `backend/` and `frontend/`.

## Format

Each decision should include:
- Date and ADR number
- Context (why the decision was needed)
- Decision (what was chosen)
- Alternatives considered
- Consequences (trade-offs, implications)

---

## Entries

### ADR-001: Use Next.js 15 with Turbopack (Initial)

**Context:**
- Need a modern React framework for SSR/SSG
- Want fast development experience with hot reloading
- Require good TypeScript support

**Decision:**
- Use Next.js 15 with Turbopack for development server
- Client-side components for interactive tarot features

**Alternatives Considered:**
- Vite + React Router -> Rejected: less SSR capability out of box
- Remix -> Rejected: smaller ecosystem at time of decision

**Consequences:**
- Better SEO with server-side rendering
- Fast development iteration with Turbopack
- Good TypeScript integration
- Established ecosystem and documentation

### ADR-002: Use Cryptographically Secure Random for Card Shuffling (Initial)

**Context:**
- Card shuffling needs to feel genuinely random to users
- Math.random() has predictable patterns in some implementations
- Want to avoid any perception of biased draws

**Decision:**
- Use crypto.getRandomValues() for all card shuffling
- Implemented in `src/lib/crypto-random.ts`

**Consequences:**
- More truly random card selection
- Slightly more complex implementation
- Users can trust the randomness of readings

### ADR-003: Responsive Design with Tailwind Breakpoints (2026-03-22)

**Context:**
- App must work well on mobile, tablet, and desktop
- Tailwind CSS 4 is the established styling framework

**Decision:**
- All new code must be responsive using Tailwind breakpoint utility classes (`sm:`, `md:`, `lg:`)
- Mobile-first approach: base styles target mobile, breakpoints add tablet/desktop overrides

**Consequences:**
- Consistent responsive behavior across all new pages and components
- No separate CSS media queries needed — Tailwind handles it

<!-- Add new decisions below this line -->

### ADR-004: Lean Interpretation Contract — Server-Owned Word Budget, Intent-Only Settings, Single Narrative (2026-09-01)

**Context:**
- The multi-lens interpretation flow (~2,700 lines across 14 frontend files) was over-engineered; the gnosis backend rework (`gnosis-esoterica-api/docs/prompts/lean_prompt_architecture.md`) collapses the LLM response to a single `reading` string
- With per-user dollar budgets, output length is the dominant cost — so the server must own the only lever that sets it

**Decision:**
- Word budget is fully server-owned (hardcoded `words_per_card` config in the backend); the frontend carries zero word-count logic, no depth setting, no word-estimate display
- `InterpretationSettings = {intent}` only (Reflective/Predictive); lens picker and depth slider removed from UI and wire
- Display renders one narrative under "Reading Interpretation": `reading ?? synthesis` (legacy saves and the current backend have `synthesis`; the lean backend returns `reading`); per-card texts no longer displayed but tolerated on the wire
- A reading has a single displayed interpretation slot: the newest by `created_at`; saving overwrites without a replace prompt (`PUT /api/v1/readings/{id}/interpretation`, singular)
- Session-expired mid-flow: plain login link back to the reading page (sessionStorage stash removed); the user regenerates after login

**Consequences:**
- Supersedes the multi-lens decisions from 2026-08-21 (lens tabs, per-lens slots, depth-based word budget)
- Generate/save 422s against the pre-lean backend by design; e2e verification runs once the lean gnosis backend lands
- Legacy multi-lens saves stay in the DB but only the newest is shown

**Amendment (2026-09-02, superseded same day):** `intent` was made optional and gated behind a per-spread `INTENT_SPREADS` allowlist.

**Amendment (2026-09-02): intent removed entirely** (plan `docs/remove-interpretation-intent.md`). `InterpretationSettings`/`intent`/the per-spread allowlist and the "Reading Style" affordance are gone — `generateInterpretation`/`saveInterpretation` take no tunable parameters at all, so there is no longer a "which spreads allow intent" list to maintain. The interpretation modal generates once per open with no pre-generate settings step beyond a plain "Consult the Oracle" confirm; there is no regenerate action — trying again means closing and reopening the modal via the existing entry points.


### ADR-005: One-Shot Interpretation Contract — Generate-and-Persist, One Interpretation Per Reading (2026-09-03)

**Context:**
- The lean gnosis backend (branch `new-prompt-architecture`) landed with a different interpretation API than the frontend anticipated: verified directly against its `src/interpretations/router.py` and schemas after a live 404 on the old `/generate` path
- The backend exposes exactly one endpoint, `POST /api/v1/readings/{id}/interpretation`, which generates **and persists** in the same call, is **idempotent** (a repeat call returns the stored interpretation with no LLM call and no charge — one interpretation per reading, ever), and returns `{interpretation, remaining_budget_usd}`

**Decision:**
- Frontend fully adopts this contract: `generateInterpretation(readingId)` POSTs to the singular endpoint; `saveInterpretation`/`saveInterpretationSchema` deleted (there is no save step); the modal's states collapse to confirm → generating → result/error with a "Done" close (no unsaved state, no close-confirm)
- `Interpretation` mirrors the backend's `InterpretationReadModel` exactly: `_id, reading_id, user_id, reading (required string), model, usage (nullable ledger: prompt/completion/reasoning tokens, model, cost_usd), created_at, updated_at`. Legacy `synthesis`/`card_interpretations` tolerance dropped — the backend guarantees `reading`
- `ReadingDetail.interpretation` is singular (`| null`), replacing the `interpretations` array; the journal page's "New Interpretation" button removed (regenerating is a no-op by design)
- Budget surfaced: HTTP 402 ("Usage budget exhausted") maps to "Your Oracle budget is exhausted." in `api-client.ts`; the modal's result state shows the remaining budget returned by generate

**Consequences:**
- The reading page and modal can never disagree about which interpretation to show — there is only one
- A user who dislikes their interpretation cannot re-roll; that is backend policy ("this is what the reading gets, no more")
- Charged-with-nothing-stored is impossible (backend reserves worst-case cost, persists, then settles — any failure releases the reservation)


### ADR-006: Tag Autocomplete Fed by `user_tags` on the List Payload (2026-09-09)

**Context:**
- The tags filter on `/user/readings` was a bare comma-separated text input — tags had to be typed from memory
- The backend already returns the user's whole tag vocabulary on `GET /api/v1/readings` as `user_tags: [{name, count}]` (most-used first, filter-independent, served from a derived `user_tags` collection rebuilt on every tag PATCH — migration 010), explicitly to drive a front-end tag picker
- Supersedes the "no tag autocomplete" non-goal in `docs/reference/readings/search-and-tags.md`

**Decision:**
- No extra request: the vocabulary rides the existing list payload (`PaginatedReadings.user_tags`, new `TagSummary` type) and is passed to the filter panel as a prop, defaulting to `[]` when absent
- Hand-rolled combobox (`TagFilterCombobox.tsx`) — no headless-UI dependency; chips + suggestion dropdown with keyboard nav (Arrows/Enter/Escape, Backspace-removes-last-chip), ARIA combobox/listbox roles, tarot-theme styling (purple gradient dropdown, gold accents, quick fadeIn)
- Free-text tags remain allowed (the backend matches any string); no 5-tag/25-char limits on the filter — those are per-reading storage rules
- Suggestions keep the backend's most-used-first order (prefix matches ranked before other substring matches), show counts, cap at 8; logic lives in pure functions (`src/lib/tag-suggestions.ts`) because the vitest setup has no jsdom — interactive component behavior is verified manually in real Chrome
- Apply still serializes to the same comma-separated `tags` URL param — wire format and backend matching unchanged

**Consequences:**
- The vocabulary is a per-render snapshot: a tag added on the detail page appears in suggestions only after the readings page re-renders (accepted staleness)
- Older backends without `user_tags` degrade to today's behavior (no dropdown, free text works)


### ADR-007: Readings-List Context Threaded via URL Params (2026-09-10)

**Context:**
- Opening a reading from a filtered `/user/readings?tags=...` list and "going back" lost the filter. Genuine browser back was fine — the detail page's back button and footer link were hardcoded `<Link href="/user/readings">`, i.e. forward navigations to the unfiltered list. Item links carried no params and the detail page took no `searchParams`, so the context could not survive.
- The user also wanted to step through the filtered results reading-by-reading without returning to the list.

**Decision:**
- The list context (page + filters) travels as URL params: item links always carry `page` (even `page=1`) plus active filters, via shared serializers in `src/lib/reading-list-context.ts` (`parseListContext`/`listHref`/`readingHref`) used by both pages so serialization can't drift. Presence of any context param = "came from the list" and gates the prev/next UI.
- The detail page accepts `searchParams`; all back affordances (header back button, error branch, footer link) use `listHref(ctx)`.
- Prev/next: `getAdjacentReadings(id, ctx)` in `readings/actions.ts` fetches the context page via the existing `getReadings`, computes neighbors via pure `planAdjacency` (`src/lib/reading-adjacency.ts`, unit-tested), and fetches at most one adjacent page when the reading sits at a page edge; a boundary-crossing link carries the neighbor's `page` so the chain stays consistent. UI: round gold arrow buttons flanking a "Reading N of M" indicator, directly under the interpretation card.
- No context params (direct/deep link) → no prev/next, bare back links, zero extra fetches. Rejected alternative: defaulting to an all-readings newest-first sequence — extra fetch on every direct view and a surprising sequence for visitors arriving from elsewhere.
- Any adjacency failure (fetch error, reading no longer in the filtered page because its tags changed / it was deleted / the list shifted, out-of-range page) silently hides prev/next; back keeps working. No error UI.

**Consequences:**
- The context is a per-render snapshot: adjacency is recomputed on every detail render, so list shifts self-correct as you navigate; a reading edited out of the filter loses prev/next but keeps its back link.
- Known separate issue (follow-up, out of scope): `src/proxy.ts` login-redirect sets `from` to pathname only, so a session expiring on a filtered/contextual URL drops the params after re-login.


### ADR-008: Profile Dashboard Fed by One Composed `GET /dashboard` Endpoint (2026-09-11)

**Context:**
- The profile page was a static card (name, email, links). Pavlos wanted a dashboard: account + remaining Oracle budget (as a chalice), readings count, last reading, tag chips, New/All Readings links.
- Nothing user-facing exposed the budget: `remaining_budget_usd` only rode the interpretation-generate response, and `/auth/me` carries no budget, spend, readings or tag data. Subscription/plan does not exist yet (payments work pending).

**Decision:**
- One composed backend endpoint, `GET /api/v1/dashboard` → `{user, budget_usd, remaining_budget_usd, total_readings, last_reading (GET /readings/{id} shape, interpretation embedded), user_tags}`. Budget resolution stays server-owned (ADR-004): the endpoint reports through the same helper the generate endpoint uses, so the two figures cannot drift. Built in the backend repo's own session; this repo only consumes it.
- Frontend fetches it through a `getDashboard()` server action (guarded by `getCurrentUser()` per the CLAUDE.md rule) in parallel with the page's own user lookup; a failed fetch degrades to account info + links, never a broken page.
- The chalice shows **dollars only** ("$2.41 of $3.00 remains") — matches the interpretation modal; per-reading cost varies so an exact "readings left" count would be fiction. Subscription type is **omitted** until payments land.
- `BudgetChalice` is a server component: SVG with a static clipPath, CSS-keyframe animation on nested `<g>`s (translate only, never a `transform` attribute and CSS transform on the same element — Safari-safe), `prefers-reduced-motion` honoured, `role="img"` + `<title>`. Pure level/label logic lives in `src/lib/profile-dashboard.ts` (unit-tested; vitest has no jsdom, the component has a `renderToStaticMarkup` test).
- Links reuse the ADR-007 serializers (`readingHref(id, null)` for the last reading → no prev/next fetch; `listHref({page:1, tags})` for chips).

**Consequences:**
- One round trip renders the whole page; older backends without the endpoint still get a usable profile.
- Layout-critical spacing on the new page uses inline styles / `tarot.css` classes rather than novel Tailwind utilities, because the dev server (even freshly started) served CSS lacking several of them.
- When plans/subscriptions arrive, the account panel gains a row; the chalice semantics (remaining/budget) are unchanged.


### ADR-009: Transactional Email via Resend, Sent Exclusively by the FastAPI Backend (2026-09-15)

**Context:**
- The apps need to send email (first consumer: the password-reset flow shipped 2026-09-14, which requires the backend to email `{FRONTEND_BASE_URL}/reset-password?token=...` links)
- Everything runs on a Raspberry Pi behind a Cloudflare tunnel on a residential connection — self-hosted SMTP is ruled out (ISP blocks outbound port 25, residential IPs have no deliverability; see `docs/implmentations/email.md`)
- The domain `tarotdivinations.com` is on Cloudflare DNS and already uses Cloudflare Email Routing for inbound mail

**Decision:**
- Provider: **Resend** (permanent free tier: 3,000 emails/mo, 100/day; API over HTTPS works fine from behind NAT)
- All sending centralized in the FastAPI backend behind a single internal `send_email()`; the frontend never holds a mail key and triggers emails only through backend endpoints (same shape as ADR-005/ADR-008: backend owns policy and third-party keys)
- Verify the **apex** domain in Resend; From address is `Tarot Divinations <noreply@tarotdivinations.com>`. Resend's SPF/MX live on the `send.` subdomain (return-path) and DKIM on `resend._domainkey.`, so Cloudflare Email Routing's apex MX/SPF are untouched and inbound forwarding keeps working
- Contract spec for the backend session: `docs/reference/email/email-service.md`

**Alternatives Considered:**
- Brevo (300/day free) -> bigger free ceiling but weaker SDK/DX; volume makes the difference irrelevant
- Amazon SES ($0.10/1k) -> cheapest at scale, but no free tier for new AWS accounts anymore and heavy setup ceremony (sandbox exit, IAM)
- Self-hosted SMTP on the Pi -> rejected outright (port 25 blocked, deliverability)

**Consequences:**
- Backend gains `RESEND_API_KEY` + `EMAIL_FROM` env vars and a superadmin smoke-test endpoint; frontend needs no code changes for the infrastructure itself
- Replies to `noreply@` vanish unless a Cloudflare Email Routing rule or `reply_to` is added later
- 100/day free-tier cap is far above current volume; forgot-password keeps its own rate limit regardless


### ADR-010: Support Tickets as Backend Email Relay (2026-09-15)

**Context:**
- Need a support channel for logged-in users; a helpdesk product is overkill at this scale
- ADR-009 already gives the backend a `send_email()` module; the owner's inbox is reachable via Cloudflare Email Routing

**Decision:**
- New `POST /api/v1/support/contact` (auth required) relays `{subject, message}` to `SUPPORT_EMAIL` via `send_email()`, extended with `reply_to` set to the requester so an inbox Reply reaches the user directly (From stays `noreply@` for DKIM/DMARC alignment)
- Identity (email + user_id) is always resolved from the JWT server-side — the frontend never sends it, mirroring the 2026-09-14 rule that user email never comes from client input
- Frontend: "Contact support" modal on the profile page (subject + message, zod 3–200/10–5000 — limits pinned by test to `docs/reference/support/contact-support.md`); the AccountPanel's manual-interpretation row was replaced by it, and manual entry moved to a plain text link ("Read with your own deck? Record that reading here") at the foot of the readings list and in its empty state — an icon-only button with a tooltip was tried first and judged too cryptic for the feature
- Amended 2026-09-21: the spot right of the "Filter Readings" toggle now holds an icon-only "New reading" button (`PlayingCards`, same as the profile page). This does not reverse the point above: the cryptic part was manual entry, which keeps its text hint
- No ticket persistence or threading — email relay only

**Alternatives Considered:**
- Third-party helpdesk / ticket storage in the DB -> Rejected: no volume to justify it; revisit if support traffic grows
- mailto: link -> Rejected: leaks the support address to scrapers, no structure, no auth context

**Consequences:**
- Tickets live only in the owner's inbox; per-user rate limit (~5/hour, backend) guards the on-demand email relay
- Against a backend without the endpoint, the modal degrades to the mapped 404 message — copy improves automatically once the backend ships

### ADR-011: Court Royal Significator via Golden Dawn Decans; Un-numbered Life Numbers on the Wire (2026-09-20)

**Context:**
- The Significators chart lacked the court royal that the Taroscopic copy promises. Life number cards travelled as `life number 1`, `life number 2`, which leaked ordinals to the saved view and the LLM, and the spread config carried `cards: 0` as a sentinel.

**Decision:**
- The royal is derived from the decanate pip using Golden Dawn Book T: each Knight, Queen and King rules the last decan of one sign plus the first two of the next. Rank by pip (2, 3, 10 = Queen; 4, 5, 6 = King; 7, 8, 9 = Knight); suit is the pip's own, except third-decan pips (4, 7, 10) which take the next sign's suit (Wands → Pentacles → Swords → Cups). Pages rule no decans and never appear. The King is the Golden Dawn Prince, matching `backend/src/lib/cards/court_royals.json`. The table lives in `lib/court-royals.ts`; a test states the rule independently and checks all 36 pips.
- Life numbers stay `life number 1..N` as internal Record keys; the payload sends every one as `life number` (Significators only, anchored regex, so generated `Card 1..N` keys are untouched). The backend has no uniqueness rule on positions, so no backend change.
- Saved readings re-key repeated positions with `uniquePositionKeys`, so new (repeated) and legacy (numbered) rows render identically under one "Life Numbers" banner.
- `ReadingConfig.cards` is optional; a spread without it is birth-date based (`isBirthdateSpread`).

**Alternatives Considered:**
- Change only the display and keep numbered strings on the wire -> Rejected: the LLM would keep reading the life numbers as an ordinal sequence
- Compute the royal by the birth-sign element instead of the decan -> Rejected: not the Golden Dawn attribution and it would not follow the existing decanate card

**Consequences:**
- Court royal is frontend-computed like the rest of the chart; existing readings and their interpretations have none
- Each chart carries one more distinct card, so the server-owned word budget rises by one card's share
- If a different King/Knight convention is wanted, only the table in `lib/court-royals.ts` changes

### ADR-012: Versioned Legal-Document Consent Stored per Document; Version = Dated MDX Filename (2026-10-04)

**Context:**
- The app had no legal documents and no record of consent; registration collected only an optional display name
- We must be able to prove what each user accepted, re-ask when a document changes, and let users see and revisit what they agreed to
- Design and plan docs were deleted after shipping (git history: `frontend/docs/gdpr-consent-terms-and-named-registration.md`, `docs/registration-consent-verification-cookies.md`); as-built: `docs/reference/auth/registration-verification-and-consent.md`

**Decision:**
- Terms and Privacy Policy are MDX files in `src/content/legal/<doc>/<YYYY-MM-DD>.mdx`. **The filename is the version**; the newest filename is current; every older file stays renderable at `/legal/<doc>/<date>`. Nothing else declares a version
- Each acceptance is stored on the user as `consents.<doc> = {version, accepted_at}` (backend), not as booleans. The backend stores the version string unvalidated, so a document edit needs no backend deploy
- Documents load through a generated static import map (`src/lib/legal-registry.generated.ts`, written by `scripts/generate-legal-registry.mjs` before `dev`, `build` and `test`), not `fs.readdirSync` + a template-literal `import()`: Turbopack needs literal import paths and the standalone production image has no `src/content` at runtime. A test pins the registry to the directory listing
- Registration requires first and last name plus two unticked checkboxes. Terms: "I accept". Privacy: "I have read" (an acknowledgement of notice; the lawful basis for account data is the contract, not consent). Versions sent to the backend always come from the server-side registry, never from the form
- **Re-consent gate:** `src/app/user/layout.tsx` and `superadmin/layout.tsx` redirect to `/accept-terms` when a stored version is behind (`onboardingRedirect` in `src/lib/onboarding.ts`). Data-creating server actions use `requireConsentedUser()` because layouts do not protect actions
- **Self-service:** `/user/profile/manage-consent` lets a user review both documents and re-record acceptance at any time. Unticking is not a withdrawal: there is no "account without the Terms" state, and the page says so
- **`/user/profile/delete-account` is exempt from the gate** (`isOnboardingExempt`; the proxy passes the pathname to layouts in an `x-pathname` request header). Leaving must never require accepting new terms first
- The profile shows an Agreements block: one row per document linking to the exact version accepted

**Alternatives Considered:**
- Two booleans -> Rejected: cannot prove which text was accepted or re-prompt on change
- One file per document with a version export -> Rejected: old versions would not stay renderable
- Backend-owned versions -> Rejected: every wording change would need a backend deploy
- A global blocking modal -> Rejected: public pages must stay usable; a route is simpler to reason about
- Runtime directory listing -> Rejected: breaks in the standalone image and under Turbopack

**Consequences:**
- Adding a version = add a dated file and commit the regenerated registry. Existing users (and all legacy users, whose `consents` is `{}`) see `/accept-terms` once
- `contactSupport` needs only a session (`getCurrentUser()`), not current consent, and `/accept-terms` links to the support modal: it is the route for data-access requests, so it must stay open to a user who declines a new version (changed 2026-10-10; it was behind the gate at first)
- A layout does not re-run on client-side navigation inside `/user`, so every page under `/user` and `/superadmin` (except the exempt delete page) also calls `enforceOnboarding()` (`src/lib/onboarding-gate.ts`). A new page in those sections must call it too
- `/accept-terms` is in the proxy matcher so an expired access token is refreshed where the rotated cookies can be persisted
- On public pages (e.g. `/reading`) there is no gate: a guarded action answers "Please accept the updated Terms…" and the inline login redirects to the outstanding step
- Re-saving an already-recorded version (the manage-consent page) leaves `accepted_at` untouched on the backend, so the original acceptance date is kept as evidence
- The MDX texts are drafts for legal review. Placeholders marked `[TO BE COMPLETED]` (controller identity, governing law, supervisory authority) must be filled in before launch

### ADR-013: Hard Email-Verification Gate, User Status Enum, and `__Host-` Session Cookies (2026-10-04)

**Context:**
- Registration auto-logged the user in with an unproven address
- The three session cookies were written in two places (`api-client.ts`, `proxy.ts`) with duplicated options
- A payment step is coming and must not need a redesign

**Decision:**
- **No session until the email is confirmed.** `POST /auth/register` answers `201 {detail}` with no tokens; the form shows a "check your email" panel. The emailed link opens `/verify-email?token=...`, which renders a Confirm button and posts only on click (a mail scanner that pre-fetches the link cannot burn the token). `POST /auth/verify-email` also returns no tokens: the user signs in explicitly afterwards, so a leaked link never yields a session
- The backend holds `users.status` (`pending_verification | active`; absent = active). One check, `assert_may_hold_session`, guards login, refresh and `get_current_user`. Login answers `403 {code: "email_not_verified"}`; `ApiError.code` carries it and both login forms link to `/verify-email`, where a new link can be requested
- `onboardingRedirect(user, currentVersions)` is the single frontend decision point: pending -> `/verify-email`, stale consents -> `/accept-terms`. A payment step adds one enum member (backend) and one branch (frontend)
- **One cookie module:** `src/lib/auth-cookies.ts` (edge-safe) is the only reader and writer. In production the names are `__Host-access_token`, `__Host-refresh_token`, `__Host-token_expires_at` (httpOnly, Secure, SameSite=Lax, Path=/, no Domain); in dev the plain names. Cookies are cleared with `set(..., maxAge: 0)`, never `delete`, because a `__Host-` deletion without Secure is dropped by browsers
- Access token lifetime is 3600s everywhere (config default, env examples, docs)
- Rate limits on login (IP + email) and register (IP). Because every backend call is made by the Next.js server, `publicFetch` forwards the browser address in `X-Forwarded-For` (`src/lib/client-ip.ts`); without it the limits would be global
- `REGISTRATION_ENABLED` is exposed to client components once, through `AuthProvider` / `useAuth().registrationEnabled`, and gates the Sign up links in `ProfileNav`, the login page, the inline login modal and the landing footer

**Alternatives Considered:**
- Soft gate (log in, nag to verify) -> Rejected: an unproven address would hold a session and data
- Auto-login from the verification link -> Rejected: turns the emailed link into a bearer credential
- Verifying on GET -> Rejected: mail scanners follow links
- Keeping plain cookie names in production -> Rejected: `__Host-` binds the cookie to this host over HTTPS at no cost

**Consequences:**
- Renaming the cookies signs every user out once on deploy
- `__Host-` requires HTTPS: a production build served over plain http cannot hold a session (prod is behind the Cloudflare tunnel)
- A never-verified account is deleted after 7 days (backend TTL index); a resend restarts the clock
- The 24-hour and 7-day figures shown in the UI are constants in `src/lib/verification-policy.ts` that mirror backend settings; change both together
- No cookie-consent banner: Google Analytics was removed instead (2026-10-10), see ADR-014

### ADR-014: Self-Service Account Deletion (2026-10-04)

**Context:**
- The system must be open to removing users who wish to leave. `POST /support/contact` is an inbox, not a mechanism

**Decision:**
- `/user/profile/delete-account` (linked from a danger zone at the foot of the profile and from `/accept-terms`): password plus a typed `DELETE` confirmation. The action calls `DELETE /api/v1/auth/me`, clears the session cookies and redirects to `/`
- The backend re-verifies the password and cascades: refresh tokens, interpretations, readings, tags, reset and verification tokens, throttle records naming the account, then the user document (with its usage aggregate and consent record). Deletion is immediate and irreversible
- A wrong password is `403 {code: "invalid_password"}`, not 401: `authenticatedFetch` treats a 401 as an expired token and would refresh and retry
- The action uses `getCurrentUser()`, not `requireConsentedUser()`, and the page is exempt from the onboarding gate (ADR-012)

**Alternatives Considered:**
- Support-ticket deletion -> Rejected: depends on a human and leaves no guarantee
- Soft delete with a grace period -> Rejected: more state and a retention question, for no current need
- Checkbox confirmation -> Rejected: too easy to trigger for an irreversible action

**Consequences:**
- Accepted debts, each needing a follow-up:
  - **Google Analytics** loaded unconditionally and set non-essential cookies without consent. Resolved 2026-10-10 by removing the tag and its CSP entries; the site has no analytics. A cookieless tool (Plausible, Umami) can be added later without a banner
  - **Data export** (a downloadable copy of a user's data) is not built; access requests go through Contact support with a 30-day response time
  - **Breach-notification runbook** (72-hour duty) is an operational document that does not exist yet
  - **Backups:** a deleted account stays in existing database backups until they rotate
  - **Name editing** from the profile is not built
  - **No backend-side registration gate:** `REGISTRATION_ENABLED` is enforced by the frontend only; the API's `/auth/register` is reachable from inside the container network regardless
- An access token stays valid for up to an hour after deletion for endpoints that do not re-read the user; the cookies are cleared, so it needs a copied bearer token to matter

**ADR-013 addendum (2026-10-05): password policy.** New passwords (register, reset) must be 12 to 128 characters, must not be on a bundled common-password list, must not be a repeat or plain run, and must not contain the user's name or the local part of their email. No character-mix rules: they push users to `Password1!`. No Have I Been Pwned lookup: judged overkill here, since it adds an outside dependency to sign-up and a recipient to explain. The backend owns the list and answers `422 {code: "weak_password"}` with a user-facing `detail`, which the form shows on the password field; the frontend checks only length and the name/email rule (`src/lib/password-policy.ts`) and shows a hint under the field. Login keeps the 8-character floor so existing accounts can sign in. A refused password does not consume a reset link.

**ADR-013 addendum (2026-10-05): sign-up is closed by default in production.** `frontend/docker-compose.yml` defaults `REGISTRATION_ENABLED` to `false`, reversing the 2026-10-04 default of `true`, so a deploy never opens registration by itself; it is opened on the Pi by setting the variable to `true`. Local `make dev` still defaults to open.

### ADR-015: User Guide as MDX Chapters with a TS Manifest and Overlay-Annotated Screenshots (2026-10-13)

**Context:**
- `/guide` only explained reading philosophy; nothing explained how to use the platform (register, save, interpret, filter, contact support)
- MDX is configured without remark/rehype plugins (Turbopack cannot serialise plugin functions), so there is no frontmatter; `.mdx` imports cannot use template-string paths

**Decision:**
- `/guide` is a hub; each chapter is its own page `/guide/<slug>`. The old philosophy text became the chapter `reading-the-cards`
- Chapter bodies are MDX (`frontend/src/content/guide`); order and metadata live in `lib/guide-chapters.ts`; a static import map joins them, and a test keeps the three in step
- Screenshots are raw PNGs in `public/guide/`; the `Shot` MDX component draws numbered rings from percentage coordinates kept in the MDX, plus a text legend. A missing PNG renders a "Screenshot pending" placeholder
- Chapter text quotes the real UI labels; it must be re-checked when a flow changes

**Alternatives Considered:**
- One long page with a table of contents -> Rejected: heavy with screenshots, weaker deep links
- Circles baked into the images -> Rejected: every UI change means redrawing the image, and the rings cannot scale or be read by assistive tech
- Playwright auto-capture -> Deferred: new dependency, and the interpretation shot needs a billed OpenAI call or seeded data
- Reuse the legal registry generator -> Rejected: overkill for a small fixed set of slugs

**Consequences:**
- Mark coordinates are authored by eye and need tuning when an image is added or the UI shifts
- Screenshots go stale silently; the reference doc lists what exists
