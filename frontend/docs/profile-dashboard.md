# Profile Dashboard ("Your Sanctum") — Plan

**Status (2026-09-11):** implemented and verified in real Chrome (see `docs/project_notes/issues.md`, ADR-008). Deviations from the plan below: the backend endpoint landed as `GET /api/v1/dashboard` (its own `src/dashboard` module, built in the backend repo's session — not `/users/me/dashboard`); the frontend was built to that contract, with `budget_usd` and `user_tags` both present. `AccountPanel`/`ReadingsPanel` are colocated under `src/app/user/profile/`; `space-y-8`/`mx-5`/`pt-8` were replaced by inline styles because the dev server's CSS lacked them. Safari manual pass still pending.

## Context

`/user/profile` today is a small card: Name, Email, three link rows, logout. Pavlos wants it to become a dashboard: one large card split vertically — **left = account** (name, email, remaining Oracle budget drawn as a filled chalice whose liquid drains as the budget is spent), **right = readings** (total readings, last reading with link, tag chips linking into the filtered readings list, plus "New Reading" / "All Readings" links).

Decisions made in this session:
- **Data source:** one new composed backend endpoint (`backend/`). Pavlos supplied the response shape (below).
- **Chalice label:** dollars only — `$2.41 of $3.00 remains` — matching what `InterpretationModal` already shows.
- **Subscription type:** omitted until the Mollie/payments work exists.
- Design language: the project `tarot` skill (Cinzel/Crimson Pro, gold `#d4af37`, purples, ornate corners, glows, purposeful animation).

One monorepo: `backend/` (new endpoint) and `frontend/` (page rebuild). The frontend degrades gracefully against an older backend (endpoint 404 ⇒ account info + links still render; chalice and readings stats hidden).

---

## Part 1 — Backend: `GET /api/v1/users/me/dashboard`

Response shape as given by Pavlos, **plus two additive fields** the UI needs (flagged — strike them if unwanted):

```json
{
  "user": { "_id": "...", "email": "...", "display_name": "...", "is_superadmin": false, "created_at": "..." },
  "remaining_budget_usd": 2.41,
  "budget_usd": 3.00,                                   // ADDED — chalice fill = remaining / budget
  "total_readings": 17,
  "last_reading": { ...ReadingReadModel incl. interpretation... } | null,
  "user_tags": [{ "name": "career", "count": 5 }, ...]  // ADDED — tag chips (same TagSummary as the list payload)
}
```

`remaining_budget_usd` uses the exact rule in `src/interpretations/commands/generate_interpretation.py:79-92`: `budget = user["budget_usd"] if not None else settings.user_budget_usd`; `remaining = max(budget - usage.cost_usd (default 0), 0)`. Extract it into one pure helper so the two call sites cannot drift.

### Files (backend)

- **New** `src/users/queries/get_user_dashboard.py` — `GetUserDashboardQuery(user_id)` + `GetUserDashboardHandler(user_read_repo: AuthReadRepository, reading_read_repo: ReadingReadRepository, interpretation_read_repo: InterpretationReadRepository, user_tags_read_repo: UserTagsReadRepository)`. `handle()` = `asyncio.gather` over `user_read_repo.find_by_id(user_id)`, `reading_read_repo.find_by_user_id(user_id, limit=1)` (already `created_at desc`, `src/readings/repository.py:49-62`), `reading_read_repo.count_by_user_id(user_id)`, `user_tags_read_repo.find_by_user_id(user_id)`; then, if a latest reading exists, `interpretation_read_repo.find_by_reading_id(str(doc["_id"]))` and set `doc["interpretation"]` exactly as `src/readings/queries/get_reading_by_id.py:30-33`. `user is None` ⇒ `UnauthorizedError("User not found")` (same reasoning as the generate handler).
- **New helper** `resolve_budget(user_doc: dict, default_budget: float) -> tuple[float, float]` (`budget, remaining`) in `src/auth/service.py` next to `reserve_budget`; refactor `generate_interpretation.py:79-92` and `:157` to use it.
- **Edit** `src/users/schemas.py` — `UserDashboardResponse(AppSchema)`: `user: UserResponse` (import from `src/auth/schemas.py`), `remaining_budget_usd: float`, `budget_usd: float`, `total_readings: int`, `last_reading: ReadingReadModel | None`, `user_tags: list[TagSummary]`.
- **Edit** `src/users/router.py` — `@router.get("/me/dashboard", response_model=UserDashboardResponse)` with `CurrentUserId` + `MediatorDep` (this router's other route is superadmin-only; this one is per-user — do **not** use `IsSuperAdmin`). Define it before any future `/{user_id}` route.
- **Edit** `src/main.py::_wire_mediator` (line ~72) — `mediator.register_query(GetUserDashboardQuery, GetUserDashboardHandler(user_read_repo, reading_read_repo, interpretation_read_repo, user_tags_read_repo))` (all four repos are already constructed there).
- **Tests** `tests/users/__init__.py` + `tests/users/test_router.py`, in the style of `tests/readings/test_router.py` (`client`, `auth_token`, `VALID_READING_BODY`): 401 unauthenticated; fresh user ⇒ `total_readings 0`, `last_reading null`, `user_tags []`, `remaining == budget == settings.user_budget_usd`; after two POST `/readings` ⇒ `total 2` and `last_reading._id` is the newer; after PATCH `/readings/{id}/tags` ⇒ `user_tags` populated; user doc patched via `mock_db` with `budget_usd: 1.0, usage.cost_usd: 0.4` ⇒ `remaining 0.6`; spend over budget ⇒ `0.0`. Unit tests for `resolve_budget` in `tests/auth/`.
- Docs: add the endpoint where `/readings` is documented (the repo audits docs against code — commit `1d510e0`).

Verify: `make test`, `make lint`, `make typecheck`.

---

## Part 2 — Frontend

### Data layer

- **Edit** `src/types/auth.ts` — `DashboardResponse` (wire shape; `user: MeResponse`, `last_reading: ReadingDetail | null`, `user_tags: TagSummary[]`) and camelCase `Dashboard` (`user: User`, `remainingBudgetUsd`, `budgetUsd`, `totalReadings`, `lastReading`, `userTags`) + `mapDashboardResponse()` reusing `mapMeResponseToUser`. `ReadingDetail`/`TagSummary` come from `src/types/reading.ts`.
- **Replace** the dead stub `src/app/user/profile/actions.ts` (no importers — verified) with a real `"use server"` action `getDashboard(): Promise<{ok:true; data: Dashboard} | {ok:false; error: string}>` — `getCurrentUser()` guard first (CLAUDE.md rule), then `authenticatedFetch<DashboardResponse>("/api/v1/users/me/dashboard")` (pattern: `src/app/superadmin/actions.ts`).
- **New pure helpers** `src/lib/profile-dashboard.ts` + `src/lib/__tests__/profile-dashboard.test.ts` (vitest, no jsdom):
  - `chaliceFill(remaining, budget): number | null` — `null` when either is non-finite or `budget <= 0`; else clamped `0..1`.
  - `chaliceState(fraction): "full" | "partial" | "low" | "empty"` (`<= 0` empty, `< 0.2` low, `>= 0.98` full).
  - `formatUsd(n)` → `"$2.41"` via `toFixed(2)`, negatives clamp to `$0.00` (deterministic, no `Intl`).
  - `budgetCaption(remaining, budget)` → `"$2.41 of $3.00 remains"`, or `"The chalice runs dry"` when remaining is 0.
  - `formatReadingDate(iso)` and `truncateQuestion(text, max)` — **move** `formatDate`/`truncate` out of `src/app/user/readings/page.tsx:12-24` and import them back there (one source).
  - `tagHref(tag) = listHref({ page: 1, tags: tag })` from `src/lib/reading-list-context.ts`.
  Tests: clamping (over-spend → 0, budget 0/undefined/NaN → null), state thresholds, `formatUsd` rounding/negatives, caption text, date for a fixed mid-day UTC ISO string, truncation boundary + null passthrough, `tagHref("career") === "/user/readings?page=1&tags=career"`.

### Page: `src/app/user/profile/page.tsx` (server component)

- `const [user, dash] = await Promise.all([getCurrentUser(), getDashboard()])` (`getCurrentUser` is React-`cache`d, so the guard inside `getDashboard` reuses the same `/auth/me` call); `if (!user) redirect("/user/login")`.
- Keep the "Your Sanctum" header and the five-glyph footer verbatim. Widen `max-w-lg` → `max-w-4xl` (already in the CSS bundle).
- Card: existing panel classes (`rounded-2xl border border-[#d4af37]/20 bg-gradient-to-b from-[#1a0033]/80 to-[#0a0015]/80 backdrop-blur-sm`) + `relative overflow-hidden` + `<OrnateFrame size="sm" />` (`src/components/OrnateFrame.tsx`). Inside: `grid grid-cols-1 md:grid-cols-2` (both utilities already in the bundle). Divider: an absolutely positioned 1px element at `left: 50%` with an inline vertical gold gradient, shown ≥ md via inline `@media`-free approach: render it always and hide below md with the existing `hidden`/`md:block` pair only if `md:block` exists — it does **not** yet (grep = 0), so use a CSS class in `tarot.css` (`.sanctum-divider { display:none } @media (min-width:768px) { .sanctum-divider { display:block } }`) — immune to stale dev CSS. Mobile gets the readings page's horizontal `h-px bg-gradient-to-r …` hairline between the stacked panels.
- If `!dash.ok`: left panel from `user` alone with a muted "The oracle's ledger is unavailable" line in place of the chalice; right panel shows the same line in place of the stats but still renders the New Reading / All Readings buttons.

### Left panel — `src/app/user/profile/AccountPanel.tsx` (server)

Colocated like `readings/[id]/InterpretationSection.tsx`. Small Cinzel section label "✦ The Seeker ✦"; `ProfileRow` Name / Email (move `ProfileRow` from the page into this file); the chalice centred with Cinzel label "Oracle Essence" and the Crimson Pro caption from `budgetCaption`; then the existing `ProfileLinkRow` "Manual Interpretation" and `LogoutButton` pinned to the bottom (`flex flex-col` + inline `marginTop: "auto"` on the footer block — `mt-auto` is not in the bundle yet) so both panels' bottoms align on md+.

### Chalice — `src/components/BudgetChalice.tsx` (**server** component, no hooks except `useId`)

Props `{ remainingUsd: number; budgetUsd: number; className?: string }`. Returns `null` when `chaliceFill` is `null`. All load-bearing presentation lives in SVG attributes / inline styles; only keyframe class names come from `tarot.css` (loaded globally by `src/components/TarotPageLayout.tsx:5` — verified). Wrapper `<div style={{ width: "100%", maxWidth: 160, filter: "drop-shadow(0 0 18px rgba(212,175,55,0.35))" }} className="chalice-glow">`.

`viewBox="0 0 120 160"`, ids from `useId()` with colons stripped (`url("#id")` quoted):
- **Goblet**: bowl path `M20 30 Q20 92 60 92 Q100 92 100 30 Z` (stroke `#d4af37` 2, fill `rgba(26,0,51,0.55)`), rim ellipse `cx60 cy30 rx40 ry6`, inner double-line path at 50% opacity, stem `rect x56 y92 w8 h34` with knop ellipse `cy110 rx9 ry5`, foot ellipse `cx60 cy132 rx30 ry8` + faint underside `ry10` at 40%. A tiny gold `✦` at the knop; a thin white-gold highlight curve on the bowl's left.
- **Liquid clip** `<clipPath>` = bowl inset by 3 units (`M23 32 Q23 89 60 89 Q97 89 97 32 Z`) — **static**, nothing inside it animates (Safari repaint quirk). Default `userSpaceOnUse`.
- Inside `<g clipPath>`: `<g transform={`translate(0 ${surfaceY})`}>` with `surfaceY = 89 - fraction * (89 - 32)` computed on the server (attribute, not CSS). Children:
  1. `<g className="chalice-rise">` (CSS keyframe `chaliceRise`: `from { transform: translateY(60px) } to { transform: translateY(0) }`, 1.4s ease-out, once — the level rises on load with zero JS) containing:
     - liquid body `<rect x0 y0 w120 h70 fill="url(#liquid)">`;
     - wave A `<g className="chalice-wave">` with path `M-120 0 Q-90 -4 -60 0 T0 0 T60 0 T120 0 T180 0 T240 0 V12 H-120 Z` (same gradient), keyframe `chaliceWave` `translateX(0 → -120px)` 6s linear infinite;
     - wave B `<g className="chalice-wave chalice-wave--slow">` amplitude 3, opacity 0.6, lighter fill, `chaliceWaveR` reversed 9s.
     - shimmer band `<g className="chalice-shimmer">` `rect x-40 y0 w40 h70 fill="url(#shimmer)"` sweeping `translateX(-40 → 160px)` 5s, opacity ≤ 0.25.
- **Gradients**: liquid vertical `#e6c84a → #d4af37 → #8a6a1f` (state `low`: `#c98a2e → #7a3f10`; `empty`: liquid omitted, dashed hairline at bowl bottom); shimmer horizontal `transparent → rgba(255,244,200,0.9) → transparent`.
- Rules: never put a `transform` attribute and a CSS transform on the same element (nested `<g>`s only); pure `translateX/Y` only, no rotate/scale (avoids Safari `transform-origin` issues); wave path is 120 units wide so `-120px` loops seamlessly.
- **A11y**: `<svg role="img" aria-labelledby={titleId}>` + `<title>Oracle budget: $2.41 of $3.00 remains</title>`; decorative groups `aria-hidden`.
- **Reduced motion** in `tarot.css`: `@media (prefers-reduced-motion: reduce) { .chalice-wave, .chalice-wave--slow, .chalice-shimmer, .chalice-glow, .chalice-rise { animation: none !important; } }` — static liquid at the correct level still conveys the value.
- `tarot.css` additions: `chaliceWave`, `chaliceWaveR`, `chaliceShimmer`, `chaliceGlow` (opacity 0.55↔1, 4s), `chaliceRise`, the five classes, the reduced-motion block, and `.sanctum-divider`.
- **Test** `src/components/__tests__/BudgetChalice.test.tsx` via `renderToStaticMarkup` (pattern: `Reading.layout.test.tsx`): `remaining 1.5 / budget 3` ⇒ markup contains `translate(0 60.5)` and title `$1.50 of $3.00`; `clip-path` references the generated id; two `chalice-wave` groups; `budget 0` ⇒ renders nothing; `remaining 0` ⇒ no liquid rect, "runs dry" title.

### Right panel — `src/app/user/profile/ReadingsPanel.tsx` (server)

Section label "✦ The Journal ✦".
1. **Stat**: `text-4xl` Cinzel gold number with glow text-shadow + "Readings" label; `0` ⇒ the readings page's empty line "The cards await your first question".
2. **Last reading** mini-card: the list-item idiom from `src/app/user/readings/page.tsx:124-165` (spread type, `<time>` via `formatReadingDate`, italic truncated question, small "✦ Interpreted" marker when `lastReading.interpretation` is non-null, "View Reading ›"), whole card `<Link href={readingHref(id, null)}>` (null ctx ⇒ no prev/next fetch, ADR-007).
3. **Threads** (tags): `flex flex-wrap gap-1.5`; each `<Link href={tagHref(name)}>` with the chip classes from `readings/page.tsx:174-176` + `hover:border-[#d4af37]/40` (in bundle) and a muted `· count`. Show at most 12, then a "+N more" chip → `listHref(null)`. Section hidden when empty.
4. **Actions**: primary gold "✦ New Reading ✦" → `/reading` (classes from `readings/page.tsx:108-111`) and outlined "All Readings" → `listHref(null)` (LogoutButton border idiom). Stack on mobile with inline `display:flex; flexDirection` via a `tarot.css` class (`sm:flex-row` not in bundle) or just `flex-col` + `sm:flex-row` after a dev-server restart (prod is unaffected either way).

### Cross-browser / responsive notes
- Both panels stack below `md` (768px); chalice scales with its wrapper (`max-width:160px`, `height:auto`).
- New Tailwind utilities used: none load-bearing. Anything that looks dead in dev ⇒ restart `npm run dev` before debugging (see 2026-09-10 incidents in `docs/project_notes/issues.md`).

---

## Sequencing

1. Backend: helper + query + schema + route + wiring + tests (`make test lint typecheck`). Run the backend locally.
2. Frontend types + `getDashboard` action.
3. `profile-dashboard.ts` helpers with tests (TDD), refactor `readings/page.tsx` to import them.
4. `tarot.css` keyframes/classes.
5. `BudgetChalice.tsx` + markup test.
6. `AccountPanel.tsx`, `ReadingsPanel.tsx`, rewrite `page.tsx`.
7. Verification, then bookkeeping.

## Verification

- Backend: `make test`, `make lint`, `make typecheck`; `curl -H "Authorization: Bearer $T" localhost:8000/api/v1/users/me/dashboard` shows the shape with `budget_usd`, `user_tags`.
- Frontend: `npx tsc --noEmit`, `npm test` (new tests + existing 103 green), `npm run build`. Restart `npm run dev`.
- Real Chrome **and** Safari, logged in against the local backend: md+ side-by-side with equal-height panels and visible divider; 375px stacked; liquid level = remaining/budget; waves loop with no seam; shimmer clipped to liquid; rise animation on load; macOS Reduce Motion stops all chalice motion; tag chip → `/user/readings?page=1&tags=<tag>` filtered; last-reading card → detail page without prev/next row; New Reading → `/reading`; All Readings → `/user/readings`. Point at an old backend (or stop it) ⇒ fallback render, no runtime error. VoiceOver reads the chalice title.

## Bookkeeping
- `docs/project_notes/issues.md` entry (frontend); ADR-008 in `decisions.md`: "Profile dashboard fed by one composed `GET /users/me/dashboard` endpoint" (one round trip; budget resolution stays server-owned per ADR-004; additive `budget_usd`/`user_tags` fields).
- Update the stale routes list in `docs/project_notes/key_facts.md` (add `/user/*`, `/superadmin`).
