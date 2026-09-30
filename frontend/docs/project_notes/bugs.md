# Bug Log

This file tracks bugs encountered and their solutions. Keep entries brief and chronological.

## Format

Each bug entry should include:
- Date (YYYY-MM-DD)
- Brief description of the bug/issue
- Solution or fix applied
- Any prevention notes (optional)

Use bullet lists for simplicity. Older entries can be manually removed when they become irrelevant.

---

## Entries

<!-- Add new bug entries below this line -->


- **2026-08-27 — New Tailwind utilities missing in dev (RelationshipLayout rendered as one column)**
  - `RelationshipLayout` (3×3 relationship spread) rendered as a single stacked pillar. Cause was not the component: `.grid-cols-3` (plus `gap-x-1`, `gap-y-4`, `text-[9px]`) were absent from the CSS the browser had loaded, so `grid-cols-3` fell back to `display: grid` with one implicit column.
  - Turbopack served the Tailwind chunk under a stable filename (`_next/static/chunks/src_app_globals_<hash>.css`) whose hash did not change when new utilities were generated, so Chrome kept serving its cached copy — even through a hard reload.
  - Fix: `rm -rf .next`, restart `npm run dev`, then load the page with a cache-busting query (`/reading?cb=1`). No code change needed.
  - Prevention: when a brand-new component's Tailwind classes appear to do nothing, probe first — `getComputedStyle` on a throwaway element with the class, and `curl` the served CSS chunk. If `curl` has the rule and the browser doesn't, it's the cache, not the markup.

- **2026-09-03 — Recurring "new code does not render" in dev: immutable cache headers applied to dev chunks**
  - Root cause of the recurring staleness (including the 2026-08-27 Tailwind-utilities incident): `next.config.ts` `headers()` set `Cache-Control: public, max-age=31536000, immutable` on `/_next/static/:path*` — and Next applies custom headers in dev too. Turbopack dev chunk filenames are module-path-hashed, NOT content-hashed (`src_app_globals_91e4631d.css` keeps its name when contents change), so `immutable` told the browser to serve year-old chunks without ever revalidating. Verified live: dev served that exact header before the fix.
  - Fix: `headers()` now returns only `securityHeaders` unless `NODE_ENV === 'production'`; all long-lived cache entries are prod-only. Dev chunks now get Next's default `no-store, must-revalidate` (verified after restart). Prod is unaffected — its chunk names are content-hashed (Next sends immutable for `/_next/static` in prod by default anyway; the custom entries mainly matter for `public/` assets).
  - One-time cleanup per browser: copies cached before the fix still carry the year-long stamp — hard refresh with DevTools "Disable cache", or Clear site data for localhost. After that, `rm -rf .next` / `?cb=1` rituals are no longer needed for this class of problem.
  - Prevention: never ship `immutable` on URLs whose content can change under the same name; gate any cache-tuning header on production.

- **2026-09-15 — Typed input wiped on a failed form submit (React 19 + `useActionState`)**
  - The Contact Support modal lost the subject/message the user had typed whenever the server action returned a validation or API error. React 19 resets every uncontrolled `<input>`/`<textarea>` in a `<form action={…}>` to its `defaultValue` after the action settles — whether or not it succeeded — so the fields went blank next to their error messages.
  - Fix: the action echoes the submitted values back on failure (`AuthFormState<TValues>.values`, typed per form — `ContactSupportFormState` uses the zod-inferred `ContactSupportInput`) and the form passes them into the `defaultValue` prop on `AuthField`/`AuthTextArea`. Login/register/forgot-password forms are equally affected and can adopt the same `values` field; never echo passwords.
  - Prevention: any `useActionState` form with uncontrolled fields needs either echoed `values` → `defaultValue` or controlled inputs; check this when adding a new auth-style form.

### 2026-09-21 — Stale view flashed after "Done" in the interpretation modal
- **Symptom:** clicking Done after an interpretation briefly showed another view before the saved reading appeared: from the game, the finished-reading view; on a saved reading, the page still without its interpretation.
- **Cause:** `InterpretationModal.handleClose` called `onComplete()` (`router.push` in `TarotGame`, `router.refresh` in `InterpretationSection`) and then `onClose()` at once. Both router calls resolve asynchronously and there is no `loading.tsx`, so Next kept the old page on screen with the modal already gone.
- **Fix:** the modal runs `onComplete` inside `useTransition` and only calls `onClose` once the transition has committed; Done is disabled meanwhile, and repeat dismissals (X, Escape, backdrop) are ignored. No caller changes.
- **Verified:** puppeteer-core against a throwaway page, sampling every frame. Old code exposed the stale view for 6 frames (push) and 50 frames (refresh with an 800ms server render); fixed code 0 in both, modal and new view swapping in the same frame. Used the idempotent generate path on an already-interpreted reading, so no LLM cost.
- **Prevention:** after `router.push`/`router.refresh`, do not tear down the current UI synchronously — wrap the call in a transition and react to its pending flag.

### 2026-09-30 — Profile/login button covered a card in the 78-card deck on phones
- **Symptom:** on a phone, once a spread was started and the full deck rendered (shuffled or face-up), the round profile button sat over the top-right card, so that card could not be tapped.
- **Cause:** `ProfileNav` is mounted once in the root layout as `fixed top-4 right-4 z-[9999]`. On phones the deck grid spans the viewport width (14px from the right edge at 390px) and `TarotGame` scrolls the deck to the top of the viewport when it appears, so the pinned button always overlapped whichever card was in that corner. On desktop the grid's side margins (about 212px at 1280px) kept the button clear, which is why it only showed on mobile. The page's own Portal link in the same corner row is `absolute`, so it never had the problem.
- **Fix:** `ProfileNav` is `absolute lg:fixed`. The deck grid (`max-w-[856px]` in FaceUpDeck/ShuffledDeck, inside the page's `px-4` padding) only grows side margins wider than the button's ~56px footprint once the viewport is about 968px wide — an initial `sm:fixed` (640px) attempt left a gap from 640-950px (tablets, and landscape phones) where the button was pinned but the deck still had no margin, reproducing the same overlap. `lg` (1024px) is the smallest default Tailwind breakpoint that clears it. Trade-off: below `lg` the menu is only reachable at the top of a page.
- **Verified:** headless Chrome over CDP at 390×844 with a real click-through to the deck. Before: `elementsFromPoint` at the button's centre returned the profile button, with "Pick card 9" beneath it. After: no card intersects the button at scroll 0 or with the deck scrolled to the top, and at 1280×800 the nav still computes as `fixed` with no overlap. `ProfileNav.layout.test.tsx` pins the class contract and asserts (by reading the deck grid's and button's actual Tailwind classes) that whichever breakpoint is chosen is wide enough to clear the deck's margin — so a future change to either side's classes that reopens the gap fails the test instead of only being caught by point-sampled viewport checks.
- **Prevention:** anything pinned to a viewport corner needs checking against full-width mobile *and mid-range tablet* layouts, not just a phone width and a wide desktop width — the deck pages have no safe corner until the grid's margin is provably wider than whatever sits in that corner.
