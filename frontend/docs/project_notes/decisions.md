# Architectural Decisions

This file logs architectural decisions (ADRs) for the Tarot Divinations project. Use bullet lists for clarity.

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
- Supersedes the "no tag autocomplete" non-goal in `docs/search-and-tags.md`

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
