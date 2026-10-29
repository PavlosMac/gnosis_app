# Frontend animation load: remove what is not needed

Status: approved 2026-10-29; revised the same day (static starfield, static landing rims, card
thumbnails added as Part 6). Parts 1 and 2 shipped. Parts 3-6 not started.

## Context

A colleague's older laptop fan spins up when running the app. A static audit (146 agents, 43
verified findings merged into 9 problems) found the load comes from three things stacking:
about 26 `backdrop-blur` elements over an always-twinkling starfield, the starfield itself
(100 infinite animated nodes copy-pasted in 5 files), and `border-flow` repainting
`background-position` on the landing page. No percentage reduction can be quoted without
profiling, so none is promised here. This plan makes only the changes known to remove cost
from things the app does not need, and defers anything that needs measurement or redesign.

Only ADR-008 in `docs/notes/decisions.md` is touched: it introduced the chalice as the
profile's budget display. Part 5 supersedes that on the user's say-so, so a dated note goes
under it. No other ADR conflicts.

First action on approval: copy this plan to
`docs/plans/2026-10-29-frontend-animation-load.md` with `Status: approved, not started` on
the first lines, per the repo docs protocol. Delete it when the last part ships.

## Working method (repo preferences)

One part at a time: implement, test, then stop for the user's "ok commit". No commits or
branches unprompted. Keep scope lean; reuse existing visuals; add nothing new visual.

## Part 1: Remove backdrop blur (biggest win, mostly deletions)

- Scrims: `SanctumModal.tsx:58` `bg-black/80 backdrop-blur-sm` to `bg-black/90`;
  `TarotGame.tsx:799` `bg-black/70 backdrop-blur-sm` to `bg-black/85`; `TarotGame.tsx:801`
  drop `backdrop-blur-md` (panel is already `/95`).
- Panels, list rows, inputs, menus, `FaceUpDeck` tray (about 20 more sites, found with
  `grep -rn "backdrop-blur" frontend/src`): delete the blur class. Raise `/80` alpha to
  `/90` on tall text panels (legal, about, guide).
- Exceptions: `ReadingsFilterPanel.tsx:147` (`/60`) and the `TarotLanding.tsx:221` button
  (10-15% tint) are not near-opaque. Raise alpha slightly there, do not just delete.
- No blanket `sed`. Review each site.
- Tests: `AboutSections.layout.test.tsx` asserts the `ArticleSection` alpha; update it if the
  alpha changes. Grep other layout tests for `backdrop-blur` assertions.

## Part 2: Static starfield and reduced motion (shipped)

- One `<Starfield />` server component (`frontend/src/components/Starfield.tsx`) replaces
  the five copy-pasted starfields. 40 static stars with deterministic position and
  brightness; no animation at all. The twinkle keyframe, class and modal pause rule are gone
  from `tarot.css`. Revised from the original "40 twinkling stars, paused behind modals": an
  always-on background animation was the one cost every page paid while idle, and a static
  sky loses nothing the app needs.
- One appended `prefers-reduced-motion` block stops the remaining decorative loops and
  one-shot entrances; `motion-reduce:animate-none` on the two 404 spinners.
- Test: `Starfield.test.tsx` (count, no animation, determinism, brightness range, CSS).

## Part 3: Landing and 404 page static

Revised from "border-flow on hover only": make every infinite animation on these two pages
static instead. Simpler, and no touch-versus-mouse inconsistency. Visible change: the rims
no longer shimmer anywhere; the user has accepted this.

- `border-flow` rims (`TarotLanding.tsx:29,141,250`, `not-found.tsx:100`): keep the gradient,
  drop `animate-border-flow` / `animate-border-flow-fast`. Then delete the keyframe and the
  two classes from `tarot.css` and from the reduced-motion block.
- Pulses (`TarotLanding.tsx:151,169,278` `animate-orb-pulse`, `animate-glow-pulse`,
  `animate-pulse-slow`; `not-found.tsx:29` `animate-glow-pulse`): drop the class, set the
  element to its resting opacity. Delete the three keyframes and classes as above.
- 404 `animate-spin` rings: drop the spin (and the `motion-reduce` guards with it).
- Hover shadow (`TarotLanding.tsx:21-25,132-136,241-245`): `transition-all duration-700` to
  `transition-shadow duration-300`, blur 80-100px to about 40-50px.
- Check `TarotLanding.layout.test.tsx` and `ShuffleOrbit.test.tsx` for assertions on the old
  classes; update `Starfield.test.tsx`'s reduced-motion check if the class list shrinks.

## Part 4: Small removals

- Deck cards: delete `will-change: transform` from `.card-flip-inner` (`tarot.css:266`);
  in `ShuffledDeck.tsx:75` mount the front face (and its glow shadow) only when `selected`.
  Leave `preserve-3d` alone (Safari flicker risk).
- Chalice: removed entirely in Part 5 (replaces the earlier drop-shadow-only fix).
- Filter panel (`ReadingsFilterPanel.tsx:179-183`): replace the animated `grid-template-rows`
  and `margin-top` with `{isSignificators && (<div className="animate-fadeIn">...</div>)}`;
  drop the `-mt-5` hack and `disabled` toggle.

## Part 5: Remove the budget chalice, keep an empty container

The user will add a tarot card visual in this slot later. The chalice is five infinite SVG
animations plus a `drop-shadow` filter, so removing it is itself a load win.

- `AccountPanel.tsx` (`frontend/src/app/user/profile/`): replace the `BudgetChalice` block
  (lines ~60-92) with a placeholder container that keeps the same `flex-1 flex flex-col
  items-center justify-center py-8` slot: an `aria-hidden` card-proportioned box
  (`aspect-[2/3] w-full max-w-[200px]`, rounded, faint `border-[#d4af37]/10`), empty, with a
  short comment saying a tarot card visual goes here. Keep the `budget` prop and the
  dashboard fetch untouched so the future visual can use them.
- Assumption to flag to the user: drop the "Remaining Readings" label, the "The chalice
  runs dry" caption and the "ledger is unavailable" line with the chalice, since a label over
  an empty box reads oddly. The interpretation modal still says "Your Oracle budget is
  exhausted", so users are not left without a signal. Easy to keep the label if preferred.
- Delete `src/components/BudgetChalice.tsx` and `__tests__/BudgetChalice.test.tsx`.
- `tarot.css` lines ~329-373: delete the chalice keyframes, classes and their
  reduced-motion block.
- Keep `src/lib/profile-dashboard.ts` and its test for now: `chaliceFill` and friends are
  likely inputs for the future visual. Say so in the summary; delete later if unused.
- Update `AccountPanel.test.tsx`: the three chalice cases (label, `flex-1`/`max-width:200px`,
  "chalice runs dry") become one test asserting the container renders, is `aria-hidden`,
  and no `$` appears.
- Guide: `content/guide/your-profile.mdx` (the mark label at line 10 and the "Remaining
  Readings is a chalice" bullet) and `oracle-interpretation.mdx:58` (chalice bullet) need
  rewording. The profile screenshot (`npm run guide:webp`) shows the chalice and will need a
  retake; I cannot retake it, so flag it as a follow-up for the user.
- Docs: `docs/notes/key-facts.md:64` (drop "Remaining Readings chalice"),
  `docs/reference/interpretations/user-accounting.md` rows at 117 and 153 (BudgetChalice
  files and test), and a dated note under ADR-008 in `docs/notes/decisions.md` rather than
  rewriting line 161. Run `make docs-check`.

## Part 6: Local card thumbnails for the manual picker

`FaceUpDeck` loads all 78 cards from `steve-p.org/cards/small/` (about 58 KB each) and shows
them at roughly 56x90 px; the browser keeps a full decoded bitmap per card. Likely source of
the 120 and 251 MB tab-memory readings. Generate a local set at twice display size (about
112x180, webp) under `frontend/public/cards/thumbs/`, add a `thumbUrl` beside `imageUrl` in
`lib/cards.ts`, and point the picker grid and the tray at it. Everything else keeps the
full image. While there, reproduce the sticky-tray bug the audit named and fix it if small.

## Deferred (needs measurement or is not a load fix)

Dead CSS cleanup, uninstalling `framer-motion` (unused,
no runtime cost). Raise after Parts 1-4 are profiled.

## Verification

- `npx --prefix frontend tsc --noEmit` and `npm --prefix frontend test` after each part.
  `npm run lint` is broken (`next lint` is gone in Next 16), so do not rely on it.
- `make docs-check` after the plan file is added.
- Visual pass in Chrome and Safari: modal scrim, legal page, landing, 404, and the profile
  page with its empty container.
- Before/after: Chrome Task Manager tab CPU and Activity Monitor GPU on `/`, a reading page
  and the Oracle wait, on a production build (`npm run build && npm start`), not dev mode.
  Report the measured drop afterwards; do not quote one in advance. Also ask the colleague
  whether they run `make dev`, since Docker and the Next dev server can spin the fan too.
- On completion add a dated line to `docs/notes/issues.md`.

## Baseline (before any change)

Chrome Task Manager, production build, one click-through of the app on the user's machine,
2026-10-29. Tab memory 25 / 56 / 120 MB. Tab CPU 0.1 to 20 percent. The three memory
figures and the CPU range are as reported; which scenario gave which figure was not
recorded. GPU Process row not captured. Repeat per page after each part, and add the GPU
Process row, since blur and compositing cost lands there and not in the tab's CPU.
