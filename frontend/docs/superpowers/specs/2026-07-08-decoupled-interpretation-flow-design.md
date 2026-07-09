# Decoupled Reading Save + Interpretation Flow (Frontend)

**Date:** 2026-07-08 (revised 2026-07-09)
**Status:** Approved
**Backend spec:** `gnosis-esoterica-api/docs/advanced-intrepretation.md` (readings/interpretations split)

## Summary

The backend splits "create reading" and "generate interpretation" into separate
endpoints. The frontend adopts the split fully: saving a reading, generating an
interpretation, and saving that interpretation become three distinct user
actions, each mapping to exactly one API call. Nothing is chained silently —
`POST /readings` never triggers an LLM call.

Interpretation tuning uses the backend's settings model:
`settings: { style, depth, tone }` where `style` is one of
`practical | reflective | spiritual | esoteric`, and `depth`/`tone` are ints
0–100. Band labels: depth 0–25 brief / 26–50 standard / 51–75 detailed /
76–100 comprehensive; tone 0–33 gentle / 34–66 balanced / 67–100 direct.
The raw 0–100 int is always what's sent; bands are display-only.

The work ships in three steps matching the backend build order (see
"Build order" below). Step 1 delivers the full decoupled flow with no tuning
controls; Step 2 adds the tuning UI; Step 3 adds profile defaults and the
list badge.

## Backend API (consumed)

- `POST /api/v1/readings` — create reading only, returns reading with `_id`
  and `interpretation: null`.
- `POST /api/v1/readings/{id}/interpretation/generate` — body: optional
  `context` (≤100 chars), optional `settings` (`{style, depth, tone}`, each
  field individually optional; omitted fields fall back server-side).
  Returns interpretation content **including the resolved `settings`
  actually used**. This echo exists from Step 1 (hardcoded defaults
  `{style: "reflective", depth: 60, tone: 50}` before tuning ships), so the
  request/response shapes never change between steps. Not persisted.
- `POST /api/v1/readings/{id}/interpretation` — save (upsert by `reading_id`);
  body echoes generated content + the **whole `settings` object** + `context`.
- `GET /api/v1/readings/{id}` — reading with nested
  `interpretation: {...} | null` (includes `settings` and `context`).
- `GET /api/v1/readings` — list items include `has_interpretation: bool`
  **from Step 3 only**. Do not build the badge against the Step 1/2 API.
- `PATCH /api/v1/auth/me` — body: `interpretation_settings`
  (`{style, depth, tone}`). Step 3 only. Defaults appear **only** on
  `/auth/me` (`interpretation_settings` on the backend `UserResponse`);
  admin/user-list responses never carry them.

### Settings baseline rule

The tweak UI is always baselined from the `settings` echoed by the most
recent generate response (or from `savedInterpretation.settings` when opening
in tweak state from the detail page) — **never** from the profile default.
The profile value only drives the profile page's own settings UI. Reasons:
the echo is authoritative even when the backend defaulted fields server-side;
profile defaults don't exist until Step 3; and after an inline login (flow 9)
`TarotGame`'s `user` prop is stale, so no profile value is available anyway.

### Open questions for the backend

1. Does `PATCH /readings/{id}/tags` return the reading with the embedded
   `interpretation` populated (same lookup as `GET /readings/{id}`), or
   `null` even when one is saved? Frontend `UpdateTagsResult` wraps the full
   `ReadingDetail`; a false `null` would hide a saved interpretation after
   tagging. If not populated, narrow the tags response type to just the tags.
2. Does `PATCH /auth/me` return the updated user, or does the profile page
   need a refetch after saving defaults?

## User flows

1. **Save a reading (no interpretation):** after all cards are revealed, a
   bookmark ribbon appears pinned to the top-right of the spread. Clicking it
   saves the reading; the ribbon turns solid gold ("Saved to Journal").
   Caption near the ribbon: *"Save this reading to get an interpretation"*.
2. **Interpret (gated by save):** the "✦ Oracle Interpretation ✦" button is
   hidden until the reading is saved; it fades in after the ribbon save.
   Clicking it opens the interpretation modal, which generates immediately
   with no `settings`/`context` in the body (backend resolves defaults; the
   response echoes what was used). No inputs shown on first generate.
3. **Preview → approve → save:** the generated interpretation is shown in the
   modal with "✦ Save Interpretation ✦" (primary) and "Tune & Regenerate"
   (secondary; in Step 1, a plain "Regenerate" that re-runs generate
   unchanged — see Build order). Nothing persists until the user saves.
4. **Tune & regenerate (Step 2+):** the tweak step shows:
   - a 4-option style selector (`practical / reflective / spiritual /
     esoteric`),
   - a depth slider (0–100) with its band label ("detailed") and raw value,
   - a tone slider (0–100) with its band label ("balanced") and raw value,
   - an optional context textarea (≤100 chars, live counter),
   all pre-filled from the `settings`/`context` that produced the shown
   result (per the baseline rule above). The regenerate button is disabled
   until settings or context differ from those inputs (`lastGenerated`
   guard).
5. **Reopen from the journal:** list items badge on `has_interpretation`
   (Step 3). Detail page (`/user/readings/[id]`) renders:
   - `interpretation === null` → oracle-style card layout (reusing the
     completed-reading visuals) + "✦ Oracle Interpretation ✦" button opening
     the same modal.
   - interpretation present → inline `InterpretationDisplay` + "✦ New
     Interpretation ✦" button opening the modal directly in the tweak state,
     baselined on the saved `settings`/`context`.
6. **Overwrite with backup:** when a save replaces an existing
   interpretation, the old one is captured in memory (from
   `savedInterpretation`) **before** the save call, then written to
   `localStorage["interpretation-backup:<readingId>"]` **after** the save
   response succeeds, and a quiet "previous interpretation backed up" note is
   shown. If a backup exists, the detail page shows a "Restore previous
   interpretation" link that re-posts the backup through the save endpoint
   (the replaced one is backed up in its place, so restore is reversible).
   Backup is per-browser and one level deep — accepted best-effort undo.
7. **Unsaved close:** closing the modal with an unsaved generated result
   shows "Save this interpretation before leaving?" with Save / Discard.
   All three close paths route through this guard — the × button, Escape,
   and backdrop click. No `beforeunload` browser-navigation guard
   (deliberate simplification).
8. **Global defaults (Step 3):** profile page gains an "Oracle Attunement"
   section with the same style selector + depth/tone sliders (shared
   component), saving `interpretation_settings` via `PATCH /auth/me` on
   change. Per-generate overrides never change the stored defaults.
9. **Logged-out users:** the ribbon is the login entry point — clicking it
   opens `LoginToInterpretModal`; after login the reading saves and the
   interpret button appears. The old "✦ Login to Get Interpretation ✦" button
   is removed.

## Types (`src/types/`)

- `interpret.ts` — new:
  - `InterpretationStyle = "practical" | "reflective" | "spiritual" |
    "esoteric"`.
  - `InterpretationSettings { style: InterpretationStyle, depth: number,
    tone: number }`.
  - `Interpretation { card_interpretations: CardInterpretation[],
    synthesis: string, model: string, tokens_used: number,
    settings: InterpretationSettings, context?: string }`.
  - `InterpretRequest` gains the previously missing `birth_date?` field.
- `reading.ts` — `ReadingDetail`: flat `card_interpretations` / `synthesis` /
  `model` / `tokens_used` replaced by `interpretation: Interpretation | null`.
  `ReadingListItem` gains `has_interpretation: boolean` (Step 3).
- `auth.ts` — `interpretation_settings: InterpretationSettings` added to
  `MeResponse`, `User`, and `mapMeResponseToUser` **only**. `UserResponse`
  and `mapUserResponseToUser` stay unchanged — the backend exposes defaults
  solely on `/auth/me`.

## Server actions

- `src/app/user/interpret/actions.ts` — `getInterpretation` replaced by:
  - `createReading(payload)` → `POST /readings`
  - `generateInterpretation(readingId, settings?, context?)` → generate
    endpoint; first generate sends neither, so the backend resolves
    defaults. Returns the content including the resolved `settings`.
  - `saveInterpretation(readingId, interpretation)` → save endpoint; body
    echoes the generated content + full `settings` object + `context`.
- `src/app/user/profile/actions.ts` — new
  `updateInterpretationSettings(settings)` → `PATCH /auth/me` (Step 3).

All via `authenticatedFetch` (`src/lib/api-client.ts`). Zod: keep the
`.max(11)` card cap in `src/lib/validation/interpret-schemas.ts`; add
`style: enum`, `depth`/`tone`: int 0–100, `context`: max 100 chars where they
enter requests.

## Components

- **`src/lib/reading-payload.ts`** — small shared helper
  `buildReadingPayload(reading: ReadingResult): InterpretRequest`. The
  card→request mapping currently inside the modal
  (`InterpretationModal.tsx:72-90` — positions, orientation,
  position_description, trimmed question, birth_date) moves here, since the
  ribbon save in `TarotGame` now needs it before any modal exists.
- **`src/components/InterpretationModal.tsx`** — the single
  generate/preview/tweak/save surface, used by both hosts. `ModalState`
  becomes `generating | preview | tweak | saving | error`. Holds
  `lastGenerated: { settings, context } | null` (regenerate guard, set from
  the response echo) and `unsavedResult: Interpretation | null`. Props:
  - `readingId` (always a real id — the reading exists before the modal
    opens),
  - optional `savedInterpretation` (detail-page host; opens in tweak state),
  - display props the modal cannot derive itself: `spreadName`, `question?`,
    `birthDate?`, and `cardVisuals` (each host builds its own —
    `TarotGame` from `reading.positions`, the detail page from `SavedCard[]`
    + `findCardByNameSafe`, as `page.tsx:64-69` does today).
- **`src/components/InterpretationSettingsControls.tsx`** — new shared
  control group (Step 2): style selector (4 presets) + depth slider + tone
  slider, each slider showing its band label and raw 0–100 value. Used by
  the tweak step and the profile page. Replaces the previously planned
  single `CalibrationSlider`.
- **`src/components/InterpretationDisplay.tsx`** — unchanged, stays the
  shared presenter.
- **`src/components/TarotGame.tsx`** — ribbon + `savedReadingId: string |
  null` state; interpret button rendered only when `savedReadingId` is set;
  "New Reading" resets it. The existing host-level result cache goes away:
  `interpretResult` state, `onResultReceived`, and `initialResult`
  (`TarotGame.tsx:58,126-127`) are removed — the modal owns
  `unsavedResult`.
- **`src/app/user/readings/[id]/page.tsx`** — stays a server component with
  a client child for modal hosting and the restore link. The tokens/model
  footer moves inside the interpretation branch (no null crash — today
  `page.tsx:124` reads `tokens_used` unconditionally). After a save from
  this page, `router.refresh()` re-renders the server data.

## Edge cases

- Generate fails → reading already saved; modal shows existing retry UI.
- Save fails → `unsavedResult` stays in memory, retry possible. The
  localStorage backup is written only after a successful save response, so a
  failed save cannot clobber the backup.
- `context` trimmed and capped at 100 chars client-side with a counter.
- localStorage unavailable → backup silently skipped; save still works.
- Same-inputs reroll is blocked by the `lastGenerated` guard from Step 2
  onward (product decision; revisit if rerolls become a want). Step 1 has no
  tuning inputs, so its plain "Regenerate" is exempt.

## Testing

- Unit: modal state transitions, the `lastGenerated` comparison (settings +
  context, pure logic, no network), `buildReadingPayload`, and the
  depth/tone band-label mapping.
- Component: interpret button hidden until saved; null-interpretation detail
  rendering; overwrite → backup → restore round-trip; regenerate disabled
  until an input differs from `lastGenerated`.

## Build order (mirrors backend steps)

1. **Step 1 — decoupled flow, no tuning.** Ribbon save (`createReading` via
   `buildReadingPayload`), generate/preview/save modal, plain "Regenerate"
   (re-runs generate unchanged), detail-page null branch, overwrite backup +
   restore, unsaved-close guard, type migration (`Interpretation` with
   `settings`, nested `ReadingDetail.interpretation`). The save body already
   echoes the full `settings` object from the generate response.
2. **Step 2 — tuning.** `InterpretationSettingsControls`, tweak state,
   `lastGenerated` guard, context field (≤100 chars).
3. **Step 3 — defaults + badge.** Profile "Oracle Attunement" section,
   `updateInterpretationSettings`, `interpretation_settings` on
   `MeResponse`/`User`, `has_interpretation` badge on the journal list.

## Out of scope

- Interpretation history (backend keeps only the latest; localStorage backup
  is the only undo).
- Credits/token gating UI (backend counts `total_tokens_used` silently).
- Rate-limiting generate calls beyond the `lastGenerated` guard.
