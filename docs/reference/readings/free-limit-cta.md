# Free-use limit and sign-up nudge (frontend only)

A visitor without a session can try the oracle and the significator chart for free. After a
few uses in that browser, the next attempt shows a call-to-action panel instead: create an
account or log in. It is a nudge, not a paywall: nothing is enforced and the backend is not
involved. Everything that must hold (interpretations, saved readings) is already behind an
account.

## Limits

| Feature | Where | Free uses per browser | Counter key |
|---|---|---|---|
| Readings | `/reading` (shuffled spreads and the Significators birth-date spread) | 3 | `tarot:free-readings-used` |
| Significator charts | `/significators` | 2 | `tarot:free-significators-used` |

The constants live in `frontend/src/lib/free-trials.ts` (`FREE_READINGS_PER_BROWSER`,
`FREE_SIGNIFICATORS_PER_BROWSER`, grouped as `FREE_TRIALS`). Manual entry
(`/user/manual-reading`) already requires a login and is never counted or gated. `/chart` is
not limited.

## How it works

- **`lib/free-trials.ts`** (pure, unit-tested): `readFreeUses`, `recordFreeUse`,
  `hasReachedFreeLimit`, and the two helpers the pages call, `shouldShowFreeLimit` (never true
  for a logged-in user) and `recordVisitorUse` (never writes for one). Storage is injected (defaults to `window.localStorage`), every call
  is wrapped in try/catch, and a missing, malformed or blocked store counts as 0, so an
  unavailable store never blocks anyone.
- **`components/FreeLimitPanel.tsx`**: one `SanctumModal` with a `variant` (`reading` or
  `significators`) that picks the copy. The copy states no counts; below it a "What you get" list and a "Read more" link to `/about`. Primary button "Begin your journey" links to
  `/user/register`; the secondary "Enter the Sanctum" opens the caller's
  `LoginToInterpretModal` (which now takes an optional `message`). When
  `useAuth().registrationEnabled` is false only the login button is shown.
- **`components/TarotGame.tsx`** (draw mode only): a reading is counted once per reading
  object the moment the game enters the `reading` phase while logged out, which covers both
  the card flip and the birth-date spread. `startGame` shows the panel instead of dispatching
  when the limit is reached; the panel appears at the setup screen, since a finished reading
  is only left through "New Reading". A login from the panel begins the reading. The save
  ribbon above a completed reading is rendered only for a logged-in user; a visitor sees a
  separate centered icon button (lucide `BookmarkPlus`, tooltip "Log in to save this reading")
  under the cards, and a successful login saves that reading.
- **`app/significators/page.tsx`**: each successful Generate while logged out counts one
  chart; generating the same date again is not counted. At the limit Generate shows the panel and the
  last chart stays visible. A login from
  the panel runs the pending Generate.
- **Logged-in users** never see the panel and nothing is written for them. The counters are
  deliberately not cleared on login: a visitor who later logs out already has an account, so
  the nudge still fits.
- **Hydration:** the counters are read only inside event handlers and effects, never during
  render.

## Privacy

The Privacy Policy (version `2026-10-13`), section 3 "Local storage", names the two counters
alongside the display preference; it is a new version, so users are asked to re-accept. The counts are device-only and never sent to the server. Private windows and
cleared site data reset them, which is accepted.

## Tests

- `frontend/src/lib/__tests__/free-trials.test.ts`: constants, 0 when unset or malformed,
  increments, limit at exactly N, counters independent, storage throwing is harmless and
  never blocks.
- `frontend/src/components/__tests__/FreeLimitPanel.test.tsx` (`renderToStaticMarkup`, mocked
  `SanctumModal` and `useAuth`): copy per variant, register link when registration is open,
  login only when it is closed. `free-trials.test.ts` also covers the gate and counting
  decisions the pages use (`shouldShowFreeLimit`, `recordVisitorUse`) and a throwing
  `window.localStorage`. The page wiring itself (effects, modals) has no component test: the
  repo has no DOM test environment, so it is covered by the manual check below.

## Manual check

Logged out at `/reading`: complete three readings, press Begin again, the panel appears and
the panel replaces the setup screen; close it and the deck is not shuffled. On a finished
reading, the bookmark-plus button under the cards opens the login modal and a successful login saves it. At
`/significators`: generate two charts, press Generate again, the panel appears over the
second chart. Log in through either panel and the blocked action runs. Logged in from the
start: no `tarot:free-*` key appears in DevTools > Application > Local Storage.
