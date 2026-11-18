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

### 2026-10-10 — "Root / Itself / Echo" suffixes in significators headings
- **Symptom:** significators interpretations headed the life number cards "The Empress — Life Number Root", "The Hanged Man — Life Number Itself", "The World — Life Number Echo". None of those words exist in any label or config.
- **Cause:** the three life number cards travel with the identical position `life number` (ADR-011) and are told apart only by the per-card note from `lifeNumberCardNote()` ("bears your life number **itself**", "the single-digit **root** your life number reduces to", "reduces to the same root"). `_SIGNIFICATORS_TEMPLATE` asked for "card-by-card sections" with no heading rule, so the model built headings from the note's vocabulary. Static trace of the prompt, not reproduced with a live call.
- **Fix:** the template now pins each heading to the card name and position exactly as given, no orientation, no role labels or suffixes, and says the position notes are for reading, not headings (`test_significators_headings_are_card_name_and_position_only`). The notes were reworded to plain numeric sentences with no dash and no role word: "Card number 20 is your life number." / "Card number 2 is your life number reduced to a single digit." / "Card number 11 also reduces to 2." (The Fool still counts as 22.) `prompt-reference.md` regenerated. New charts only; stored narratives keep their headings.
- **Follow-up the same day:** the first live run with the new rule produced clean heading text but as bare lines (`The High Priestess — Life Number\nAt the root…`) with no `**`/`#` markers, because the heading example in the template had none. `parseNarrative()` only knew marked headings, so `tidy()` joined the title into the first sentence ("Life Number At the root of your life path"). Fix on both sides: the template now asks for the heading "as a bold line on its own" with the prose on the next line, and `narrative-blocks.ts` also accepts an unmarked `Card — Position` title line (≤ 80 chars, contains " — ", no markers or sentence punctuation, body on the next line) so stored narratives render too. Verified by running the parser over the stored narrative: 7 headings + closing paragraph.
- **Prevention:** anything the frontend puts into `position_description` is prompt text the model may quote verbatim. Keep notes factual, avoid label-like phrasing and the ` — ` pattern the card line itself uses, and give every spread template an explicit heading rule when it asks for sections. LLM output is non-deterministic, so one clean run is evidence, not proof.

- **2026-10-22 — Plaintext passwords logged and echoed on any 422.**
- **Symptom:** a request body carrying a password that failed validation (e.g. login without an email) wrote `'input': {'password': '…'}` to the warning log and returned the same list in the 422 response.
- **Cause:** `validation_exception_handler` in `src/core/exceptions.py` logged and returned `exc.errors()` unfiltered; Pydantic's `input` (and sometimes `ctx`) holds the submitted value. Found by the password-hashing audit.
- **Fix:** the handler drops `input` and `ctx` from each error, logs only `(loc, type)` pairs, and returns `loc`, `type`, `msg`. Tests: `tests/core/test_exceptions.py` (sentinel password absent from log and response). The frontend never read either field.
- **Prevention:** never log or return `exc.errors()` raw. Any new handler over request bodies must go through this one. Logs written before this fix may still hold passwords.

- **2026-11-03 — Significators: a day number of 22 shows the Ace of Pentacles.** *Fixed 2026-11-10.*
- **Symptom:** `getDayNumber(22)` on `/significators` (born on the 22nd) returns `TAROT_DECK[22]`, the first minor card, as the Day Number card.
- **Cause:** `reduceToMajorArcana` in `frontend/src/lib/significators.ts` stops reducing at `MAJOR_ARCANA_THRESHOLD` (22), so 22 passes through unreduced and `getCardByIndex(22)` lands one past the major arcana (indices 0..21).
- **Fix:** `getDayNumber` maps a reduced 22 to `FOOL_INDEX` (The Fool) while still reporting the number 22, the same mapping `cardForPersonalNumber` uses on the profile; pinned by `frontend/src/lib/__tests__/significators.test.ts`.
- **Prevention:** any lookup by numerology number must be bounded to the major arcana (`MAJOR_ARCANA_MAX_INDEX`).

- **2026-11-03 — Readings list: "Begin a Reading" went to the home page.** *Fixed.*
- **Symptom:** with no saved readings, `/user/readings` shows the first-time CTA; clicking it opened `/` instead of the Oracle at `/reading`.
- **Cause:** the empty-state `Link` in `frontend/src/app/user/readings/page.tsx` had `href="/"`, left from when the Oracle lived on the landing page. The profile's "New reading" button and the filter panel already pointed at `/reading`.
- **Fix:** `href="/reading"`.
- **Prevention:** every "new reading" entry point should use the same target; the landing page is the portal, not the Oracle.


- **2026-11-10 — Open redirect through the login `?from=` return path**
  - `isSafeReturnPath` (`frontend/src/lib/auth-return-path.ts`) accepted anything matching `/^\/(?!\/)/`, meant to allow only same-origin paths. The WHATWG URL parser treats `\` as `/` in http(s) URLs and strips tabs and newlines before parsing, so `/\evil.com` passed the regex and, used in `redirect()` after login, resolved to `https://evil.com/`. A crafted `/user/login?from=/\evil.com` link would send a user off-site the moment they signed in. Found by the 2026-11-05 security excursion (watchlist F3), verified with `new URL("/\\evil.com", origin)`.
  - Fix: the value must be a string starting with `/` with no backslash, tab or newline, and resolving it against a probe origin with `new URL()` must leave the origin unchanged. The browser's own parser is the oracle, so every such quirk is covered, not just the known one.
  - Prevention: `auth-return-path.test.ts` lists the off-origin encodings and round-trips `loginHrefFor` through the query string; the watchlist F3 recipe greps for any new `redirect()` whose target is not a literal.
### 2026-11-18 — Readings without a question opened with "With no single question to narrow it, …"
- **Symptom:** Tree of Life interpretations began by remarking that no question had been asked.
- **Cause:** the frontend sends a question only for spreads with `showQuestion` in `readings-config.json`. Tree of Life, Career Reading, Past/Present/Future and Fire/Water/Air/Earth have none, but the backend treated them as question-bearing: the standard and Tree templates carried the shared question analysis ("First determine what the question asks…") and ended on "resolves to for the question", and `build_user_prompt` added "No question was asked — let the spread itself set the agenda." The model narrated the gap. Static trace of the prompt, not reproduced with a live call.
- **Fix:** all four spreads are now `has_question=False` in `_SPREAD_VARIANTS` and their system prompts mention no question: no Oracle identity or question analysis, reversal basis reworded ("the zone makes apt" for the Tree, "the position makes apt" for the others), closing without "no restating the question", and no question line in the user prompt. The standard template is built by `_standard_template(with_question=…)`; reversal wording by `_reversal_guidance(basis)`. Tests: `test_tree_of_life_system_prompt_carries_no_question_wording`, `test_standard_spreads_without_a_question_*`. `prompt-reference.md` regenerated. New readings only; stored narratives keep their opener.
- **Prevention:** a spread whose config has no `showQuestion` must be `has_question=False` in `_SPREAD_VARIANTS`; `test_spreads_without_show_question_have_no_question_variant` reads `readings-config.json` and fails when a spread drifts. Standard spreads with `showQuestion` (Single, Two, Three Card) and a blank question still get the "No question was asked" line and may show the same opener.
