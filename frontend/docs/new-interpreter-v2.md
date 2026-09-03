# New Interpreter v2 — intent-only UI, single-narrative display

**Status:** Approved plan
**Date:** 2026-09-01
**Scope:** Frontend only (tarot-divinations); counterpart backend rework lives in `gnosis-esoterica-api/docs/prompts/lean_prompt_architecture.md`

## Context

The interpretation flow (~2,700 lines across 14 frontend files) is over-engineered. Meanwhile the gnosis backend has its own rework specced in `gnosis-esoterica-api/docs/prompts/lean_prompt_architecture.md` (§5–6): the LLM response becomes a single `reading` string, per-card texts and synthesis go away, and a budget-exhausted failure mode arrives later.

**Decided (supersedes the doc's §3/§6.3, being folded into it):** the word budget is fully **server-owned** — a single `words_per_card` config value (default 100), `total = words_per_card × cards`, ×1.5 significator scale on distinct cards. **Depth disappears from the API entirely**; `InterpretationSettings` collapses to `{intent}`. Rationale: with per-user dollar budgets, output length is the dominant cost, so the server must own the only lever that sets it; paragraph-per-card length is a product decision, not a per-reading user choice. The frontend carries **zero word-count logic**.

Agreed simplification:

- **One setting only**: Reflective vs Predictive intent. Lens picker and depth slider removed from the UI; no word-estimate display (length is server policy).
- **Wire settings**: `settings: {intent}` — nothing else. No lens, no depth, no compat fields; the word count is hardcoded in the backend. (Generate/save will 422 against today's backend — the lean backend rework in gnosis is the counterpart and lands alongside; e2e verification runs against it.)
- **Display one narrative only**, under the heading **"Reading Interpretation"**, as flowing prose with paragraph breaks. No per-card text — but the cards remain visible in their spread layout (shared `SpreadCards`) above the narrative, in both the modal preview and the reading page.
- **Render `reading ?? synthesis`**: legacy saves and the current backend have `synthesis` (+ `card_interpretations`, no longer displayed); the lean backend will return `reading`.
- **Legacy multi-lens saves**: remain in the DB; reading page shows only the most recently saved interpretation. Lens tabs removed.
- **Trim machinery**: delete the sessionStorage login-stash and the replace-confirmation overlay (a reading has one interpretation slot; saving overwrites it), and slim sticky defaults to the intent value. Keep: save button, close-with-unsaved confirm, session-expired → plain login link, auto-generate entry.

## Layout

```
┌──────────────────────────────────────┐
│   "Your question…"        (if any)   │
├──────────────────────────────────────┤
│                                      │
│   [card]   [card]   [card]           │  ← spread layout, same as the game:
│   Past    Present   Future           │    row / Tree of Life / 3×3 pillars;
│                                      │    card image + position label only
├──────────────────────────────────────┤
│       ✦ Reading Interpretation ✦     │
│                                      │
│  One flowing narrative, paragraph    │
│  breaks preserved. Every card is     │
│  named in the text as it enters.     │
└──────────────────────────────────────┘
```

Reversed cards still read visually (`TarotCard` renders them rotated) and the narrative names the orientation. Later enhancement (the lean doc guarantees card names appear verbatim in the narrative): highlight card names in the prose or link them to their `/cards/{slug}` write-up page — text anchors for per-card UI without per-card sections.

## Changes

1. **`src/types/interpret.ts`**
   - `InterpretationSettings = {intent}`; delete `LENSES` and the lens/depth types (keep `INTENTS`).
   - `Interpretation`: add `reading?: string`; keep `synthesis`/`card_interpretations` optional for legacy/current wire (display no longer uses cards); `settings: {intent}` (zod strips legacy extras).
2. **`src/lib/interpretation-defaults.ts`**
   - Sticky default stores just the intent (`readDefaultIntent`/`writeDefaultIntent`, localStorage, zod-validated).
   - Delete `LENS_LABELS`, `estimatedWordsPerCard`, the old word-budget constants, `settingsEqual` (compare intents directly). Keep `INTENT_LABELS`.
3. **Delete `src/lib/interpretation-stash.ts`** + `src/lib/__tests__/interpretation-stash.test.ts`. Session-expired actions become a plain login link built with `loginHrefFor("/user/readings/{id}")` (`src/lib/auth-return-path.ts`); after login the user regenerates.
4. **`src/lib/validation/interpret-schemas.ts`** — `interpretationSettingsSchema` becomes `{intent}` (drop lens/depth enums); `saveInterpretationSchema`: `reading` optional string, `card_interpretations`/`synthesis` optional (tolerates legacy saved shapes).
   **`src/app/user/interpret/actions.ts`** — `saveInterpretation` PUTs to `/api/v1/readings/{id}/interpretation` (singular — the lens path segment goes; the lean backend rework exposes this single-slot route). `generateInterpretation` unchanged apart from the slimmer settings.
5. **Extract `SpreadCards`** from `InterpretationSection.tsx` into a shared `src/components/SpreadCards.tsx` (props: `positions: string[]`, `cardVisuals`) — the existing component that lays cards out as in the game (Tree of Life tree, Relationship 3×3, otherwise a row) with image + position label, no text.
   **`src/components/InterpretationDisplay.tsx`** — becomes: optional question block + `SpreadCards` + **"Reading Interpretation"** heading + one prose narrative (`whitespace-pre-wrap` so paragraph breaks survive). Props: `question`, `narrative`, `positions`, `cardVisuals`. Drop `cardInterpretations` and the per-card image+text containers.
6. **`src/components/InterpretationSettingsControls.tsx`** — intent-only: the existing 2-button Reflective/Predictive toggle + description line. Delete the lens radiogroup/icons, depth slider, `savedLenses`/`cardCount` props. (Props become `intent`, `onIntentChange`.)
7. **`src/components/InterpretationModal.tsx`** — keep the tweak/generating/preview/saving/error machine, close-with-unsaved confirm, auto-generate, sticky-default write on save. Remove: replace-confirm overlay + `savedInterpretations`/`replacedInterpretation` plumbing, stash calls, lens caption (show intent label only). Internal state is `intent`; calls `generateInterpretation(readingId, {intent})`.
8. **`src/app/user/readings/[id]/InterpretationSection.tsx`** — delete lens tabs, `activeLens`, and the stash-restore effect/`initialResult`; show the interpretation with the greatest `created_at` via `InterpretationDisplay` (which now includes the spread cards, so the section's separate `SpreadCards` container remains only for the no-interpretation-yet state).
9. **`src/components/TarotGame.tsx`** — replace `interpretationSettings` state with `intent`; drop `savedInterpretations` state and modal props; `ReadingStyleModal` (shell unchanged) hosts the slimmed toggle.
10. **Error display** — keep passing the backend's error message through as today. The distinct budget-exhausted UI (lean doc §6.4) waits until the backend defines its error shape/usage field — a follow-up, not built now.
11. **Tests** — update `src/lib/__tests__/interpretation-defaults.test.ts` and `interpret-schemas.test.ts` to the new shapes.
12. Log completed work in `docs/project_notes/issues.md`; record in `docs/project_notes/decisions.md`: server-owned hardcoded word budget, settings = intent only, single-narrative display reading `reading ?? synthesis`, single displayed slot.

## Verification

1. `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`.
2. UI verification against the current backend (`localhost:8001` + dev server): settings modal shows only Reflective/Predictive; a pre-existing reading's page shows only the newest interpretation's narrative under "Reading Interpretation" — no per-card sections, no lens tabs, no crash on legacy `settings`; the spread layout (cards, no text) renders above it.
3. Generate/save e2e (payload `{settings: {intent}}`, PUT `/interpretation`, `reading` field rendered, other-intent regenerate overwrites without a replace prompt) runs once the lean gnosis backend lands — the new wire shape 422s against today's backend by design.
