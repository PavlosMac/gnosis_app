# Call to action after three shuffled readings (front-end only)

**Date:** 2026-10-10 · **Status:** spec, not started · **Scope:** `frontend/` only

## Goal

A visitor who is not logged in can shuffle and lay out readings freely. After the third
completed shuffle in their browser, the next attempt to start a reading shows a
call-to-action panel instead of the deck: create an account (or log in) to keep going.
No backend involvement. It is a nudge, not a paywall.

## Decisions

- **What counts:** one completed shuffled reading in the oracle at `/reading`, counted
  when the last card is flipped (`FLIP_COMPLETE` in `src/hooks/useGameReducer.ts`).
  Manual entry (`/user/manual-reading`) already requires a login and is not counted.
  Significator charts are not counted either (no shuffle).
- **Limit:** 3 free readings per browser. One constant, `FREE_READINGS_PER_BROWSER`.
- **When it shows:** on the fourth attempt to begin a reading (the "Begin" action that
  dispatches `START_SHUFFLE`), and never mid-reading. The three readings already
  drawn stay on screen and usable.
- **Who sees it:** visitors with no session only. A logged-in user never sees it and the
  counter is not incremented for them. When a visitor logs in or registers, the panel
  goes away; the counter is cleared on login.
- **Storage:** `localStorage` key `tarot:free-readings-used`, an integer. Device-only; it
  is never sent to the server. Private windows and cleared site data reset it, which
  is accepted (nudge, not enforcement).
- **Copy (draft):** title "The Oracle Awaits"; body "You have drawn three readings. Create
  a free account to keep reading, save your spreads and ask the Oracle for an
  interpretation."; primary button "Begin your journey" → `/user/register`; secondary
  link "Already have an account? Enter the Sanctum" → opens the existing login modal.
  When registration is closed (`useAuth().registrationEnabled` is false), the primary
  button is the login action instead.

## Design

```
TarotGame (client)
  ├─ lib/free-readings.ts        pure: read/increment/clear the counter, hasReachedLimit()
  ├─ on FLIP_COMPLETE            if !isLoggedIn → increment
  ├─ on Begin (START_SHUFFLE)    if !isLoggedIn && hasReachedLimit() → show ReadingLimitPanel
  └─ ReadingLimitPanel           SanctumModal (size sm): copy + Sign up / Login
                                   Login → existing LoginToInterpretModal → onSuccess clears counter
```

- **`src/lib/free-readings.ts`** (pure, unit-tested): `readFreeReadingsUsed()`,
  `recordFreeReading()`, `clearFreeReadings()`, `hasReachedFreeLimit()`. Every
  `localStorage` call is wrapped in try/catch and treats a missing or malformed value
  as 0, following the existing `tarot:spread-preview-open` pattern in `TarotGame.tsx`.
  Storage access is injected (a `Storage`-like `{getItem, setItem, removeItem}`) so the
  tests need no DOM.
- **`src/components/ReadingLimitPanel.tsx`** (client): a `SanctumModal` with the copy
  above, following `LoginToInterpretModal.tsx` for structure and `AuthButtonLink` /
  `AuthLink` from `AuthPageShell.tsx` for the buttons.
- **`TarotGame.tsx`:** one `useState` for the panel, the increment on `FLIP_COMPLETE`,
  the check in `handleStart` before `START_SHUFFLE`, and `clearFreeReadings()` inside
  `handleLoginSuccess`. Nothing changes in the reducer.
- **Hydration:** the counter is read in a `useEffect`, never during render, so the
  server-rendered deck matches the client on first paint.

## Privacy Policy

Section 3, "Local storage", widens from "a small interface preference" to: "We also store
a small amount of interface state in your browser's local storage, such as a display
preference and how many readings you have drawn without an account. This information
remains on your device and is not sent to us." Same dated file (unpublished), edited in
place.

## Out of scope

- Enforcement. Anything that must hold (interpretations, saved readings) is already
  behind an account and the backend; this spec does not change that.
- Counting across devices or browsers.
- A/B testing the limit or the copy.
- Showing the panel to logged-in users whose budget is spent (that is the Oracle
  Chalice's job).

## Tests

- `src/lib/__tests__/free-readings.test.ts`: 0 when unset or malformed; increments;
  limit reached at exactly 3; clear; storage throwing is treated as 0 and does not throw.
- `src/components/__tests__/ReadingLimitPanel.test.tsx` (`renderToStaticMarkup`,
  mocked `useAuth`): primary button is Sign up when registration is enabled and Login
  when it is not.

## Verification

Logged out at `/reading`: complete three readings, then press Begin a fourth time → the
panel appears, the third reading is still on screen; close the panel and the deck is
not shuffled. Log in through the panel → the deck shuffles and the counter is 0 in
DevTools → Application → Local Storage. Logged in from the start: no counter is written.
Private window: the count starts again at 0 (accepted).

## Open questions

1. Should the third reading itself end with a softer hint ("one more free reading"), or
   is the panel on the fourth attempt enough?
2. Should the counter clear on login (as above) or persist, so a visitor who logs out
   again is still at the limit?
