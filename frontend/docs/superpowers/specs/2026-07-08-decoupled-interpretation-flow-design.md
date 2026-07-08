# Decoupled Reading Save + Interpretation Flow (Frontend)

**Date:** 2026-07-08
**Status:** Approved
**Backend spec:** `gnosis-esoterica-api/docs/advanced-intrepretation.md` (readings/interpretations split)

## Summary

The backend splits "create reading" and "generate interpretation" into separate
endpoints. The frontend adopts the split fully: saving a reading, generating an
interpretation, and saving that interpretation become three distinct user
actions, each mapping to exactly one API call. Nothing is chained silently —
`POST /readings` never triggers an LLM call.

## Backend API (consumed)

- `POST /api/v1/readings` — create reading only, returns reading with `_id`.
- `POST /api/v1/readings/{id}/interpretation/generate` — body: optional
  `context` (≤50 chars), optional `calibration` (int 0–5, defaults to the
  user's `interpretation_style`). Returns interpretation content. Not persisted.
- `POST /api/v1/readings/{id}/interpretation` — save (upsert by `reading_id`);
  body echoes generated content + `calibration` + `context`.
- `GET /api/v1/readings/{id}` — reading with nested
  `interpretation: {...} | null` (includes `calibration` and `context`).
- `GET /api/v1/readings` — list items include `has_interpretation: bool`.
- `PATCH /api/v1/auth/me` — body: `interpretation_style` (0–5).

## User flows

1. **Save a reading (no interpretation):** after all cards are revealed, a
   bookmark ribbon appears pinned to the top-right of the spread. Clicking it
   saves the reading; the ribbon turns solid gold ("Saved to Journal").
   Caption near the ribbon: *"Save this reading to get an interpretation"*.
2. **Interpret (gated by save):** the "✦ Oracle Interpretation ✦" button is
   hidden until the reading is saved; it fades in after the ribbon save.
   Clicking it opens the interpretation modal, which generates immediately
   using the user's global calibration default (no inputs shown on first
   generate).
3. **Preview → approve → save:** the generated interpretation is shown in the
   modal with "✦ Save Interpretation ✦" (primary) and "Tune & Regenerate"
   (secondary). Nothing persists until the user saves.
4. **Tune & regenerate:** the tweak step shows a calibration slider (0–5,
   gold→purple gradient, literal↔metaphysical axis labels) pre-filled with
   whatever produced the shown result, plus an optional context textarea
   (≤50 chars, live counter). The regenerate button is disabled until
   calibration or context differs from the inputs that produced the current
   result (`lastGenerated` guard).
5. **Reopen from the journal:** list items badge on `has_interpretation`.
   Detail page (`/user/readings/[id]`) renders:
   - `interpretation === null` → oracle-style card layout (reusing the
     completed-reading visuals) + "✦ Oracle Interpretation ✦" button opening
     the same modal.
   - interpretation present → inline `InterpretationDisplay` + "✦ New
     Interpretation ✦" button opening the modal directly in the tweak state,
     baselined on the saved `calibration`/`context`.
6. **Overwrite with backup:** when a save replaces an existing interpretation,
   the old one is written to `localStorage["interpretation-backup:<readingId>"]`
   once the save response succeeds, and a quiet "previous interpretation backed
   up" note is shown. If a backup exists, the detail page shows a
   "Restore previous interpretation" link that re-posts the backup through the
   save endpoint (the replaced one is backed up in its place, so restore is
   reversible). Backup is per-browser and one level deep — accepted best-effort
   undo.
7. **Unsaved close:** closing the modal with an unsaved generated result shows
   "Save this interpretation before leaving?" with Save / Discard. No
   `beforeunload` browser-navigation guard (deliberate simplification).
8. **Global default:** profile page gains an "Oracle Attunement" section with
   the same calibration slider, saving `interpretation_style` via
   `PATCH /auth/me` on change. Per-generate calibration overrides never change
   the stored default.
9. **Logged-out users:** the ribbon is the login entry point — clicking it
   opens `LoginToInterpretModal`; after login the reading saves and the
   interpret button appears. The old "✦ Login to Get Interpretation ✦" button
   is removed.

## Types (`src/types/`)

- `interpret.ts` — new `Interpretation` interface:
  `{ card_interpretations: CardInterpretation[], synthesis: string,
  model: string, tokens_used: number, calibration: number, context?: string }`.
  `InterpretRequest` gains the previously missing `birth_date?` field.
- `reading.ts` — `ReadingDetail`: flat `card_interpretations` / `synthesis` /
  `model` / `tokens_used` replaced by `interpretation: Interpretation | null`.
  `ReadingListItem` gains `has_interpretation: boolean`.
- `auth.ts` — `interpretation_style: number` added to `MeResponse`, `User`,
  `UserResponse`, and both mapper functions.

## Server actions

- `src/app/user/interpret/actions.ts` — `getInterpretation` replaced by:
  - `createReading(payload)` → `POST /readings`
  - `generateInterpretation(readingId, calibration?, context?)` → generate
    endpoint; omits `calibration` on first generate so the backend applies the
    profile default
  - `saveInterpretation(readingId, interpretation)` → save endpoint
- `src/app/user/profile/actions.ts` — new `updateInterpretationStyle(style)`
  → `PATCH /auth/me`.

All via `authenticatedFetch` (`src/lib/api-client.ts`). Zod: keep the
`.max(11)` card cap in `src/lib/validation/interpret-schemas.ts`; add
`calibration: int 0–5` and `context: max 50 chars` where they enter requests.

## Components

- **`src/components/InterpretationModal.tsx`** — the single
  generate/preview/tweak/save surface, used by both hosts. `ModalState`
  becomes `generating | preview | tweak | saving | error`. Holds
  `lastGenerated: { calibration, context } | null` (regenerate guard) and
  `unsavedResult: Interpretation | null`. Props: `readingId` (always a real
  id — the reading exists before the modal opens) and optional
  `savedInterpretation` (detail-page host).
- **`src/components/CalibrationSlider.tsx`** — new shared slider (0–5,
  gold→purple, literal↔metaphysical labels), used by the tweak step and the
  profile page.
- **`src/components/InterpretationDisplay.tsx`** — unchanged, stays the shared
  presenter.
- **`src/components/TarotGame.tsx`** — ribbon + `savedReadingId: string | null`
  state; interpret button rendered only when `savedReadingId` is set; "New
  Reading" resets it.
- **`src/app/user/readings/[id]/page.tsx`** — stays a server component with a
  client child for modal hosting and the restore link. The tokens/model footer
  moves inside the interpretation branch (no null crash). After a save from
  this page, `router.refresh()` re-renders the server data.

## Edge cases

- Generate fails → reading already saved; modal shows existing retry UI.
- Save fails → `unsavedResult` stays in memory, retry possible. The
  localStorage backup is written only after a successful save response, so a
  failed save cannot clobber the backup.
- `context` trimmed and capped at 50 chars client-side with a counter.
- localStorage unavailable → backup silently skipped; save still works.
- Same-inputs reroll is intentionally blocked by the `lastGenerated` guard
  (product decision; revisit if rerolls become a want).

## Testing

- Unit: modal state transitions and the `lastGenerated` comparison (pure
  logic, no network).
- Component: interpret button hidden until saved; null-interpretation detail
  rendering; overwrite → backup → restore round-trip.

## Out of scope

- Interpretation history (backend keeps only the latest; localStorage backup
  is the only undo).
- Credits/token gating UI (backend counts `total_tokens_used` silently).
- Rate-limiting generate calls beyond the `lastGenerated` guard.
