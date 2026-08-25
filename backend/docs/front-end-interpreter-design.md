# Multi-Lens Interpretations

**Status:** Draft plan — base reference for iteration
**Date:** 2026-08-21
**Branch:** `update-interpreter` (restructuring the existing three commits)

## Summary

Rework the `update-interpreter` branch so that each saved reading can hold **up to four saved interpretations — one per lens** (Traditional, Psychological, Esoteric, Alchemical), each generated with a per-interpretation **intent** (Reflective or Predictive) and a **depth** percentage controlling overall reading length, scaled by card count. The old tuning UI (style/depth/tone sliders + context) is replaced by a lens card list, intent toggle, and depth control, and the last-used settings persist as a sticky default. The decoupled save → generate → save-interpretation flow from the branch is kept; the localStorage backup/restore feature is discarded.

## Decisions (agreed 2026-08-21)

| Branch feature | Decision |
|---|---|
| 1. Decoupled save/interpret flow (3 server actions, save-ribbon in TarotGame) | **Keep**, extended to multiple interpretation slots |
| 2. Tuning controls (style enum, depth/tone sliders, context textarea, info modal) | **Replace** with Primary lens + Intent controls |
| 3. Journal-page interpretation (`InterpretationSection`) | **Keep**, reworked for multiple slots |
| 4. localStorage backup/restore of overwritten interpretations | **Discard** (lib, restore UI, tests) |
| 5. Vitest infrastructure | **Keep** |

Design rulings:

- **Slots model:** one slot per lens. Saving a lens that already has a saved interpretation **replaces that slot** (with a confirm dialog, since backup/restore is gone). Max 4 follows naturally.
- **Intent scope:** per interpretation. A reading may hold e.g. a Reflective/Traditional and a Predictive/Esoteric interpretation side by side.
- **Depth (added 2026-08-21):** a per-interpretation percentage (0–100) controlling the overall length of the reading. The word budget is derived from depth **and** card count — the total scales with depth, and the per-card share shrinks as the spread grows (more cards → fewer words per card). Computation lives in the backend prompt logic; the frontend only sends the percentage.
- **Sticky defaults:** last-used lens+intent+depth stored in `localStorage`, pre-selected on the next generation anywhere in the app; always adjustable in the modal ("Applies to every reading until you change it").
- **Dropped controls:** tone slider, context textarea, Secondary influence toggle. Only lens + intent + depth ship this iteration.

## Lens & intent definitions (UI copy)

| Lens | Description |
|---|---|
| Traditional | Conventional meanings, read plainly. |
| Psychological | Inner patterns and what they defend. |
| Esoteric | Sign, planet, path and number. |
| Alchemical | What is dissolving, joining, fixing. |

| Intent | Description |
|---|---|
| Reflective (default) | What is present, rather than what will happen. |
| Predictive | What is likely to unfold. |

**Depth** (0–100 %): how extensive the reading is. The UI shows the percentage plus a live hint of the approximate words per card for the current spread (e.g. "60% · ≈180 words per card in a 3-card spread"). Suggested budget model (backend owns the final formula):

```
total_words   ≈ lerp(MIN_TOTAL, MAX_TOTAL, depth/100)   # e.g. 150 → 1200
words_per_card ≈ total_words / card_count                # more cards → fewer words each
```

Default selection: **Traditional + Reflective + depth 60** (overridden by the sticky default once one exists).

## Data model

```typescript
// src/types/interpret.ts
export type InterpretationLens =
  | "traditional"
  | "psychological"
  | "esoteric"
  | "alchemical";

export type InterpretationIntent = "reflective" | "predictive";

export interface InterpretationSettings {
  lens: InterpretationLens;
  intent: InterpretationIntent;
  depth: number; // 0–100 percentage; length budget scaled by card count
}

export interface Interpretation {
  card_interpretations: CardInterpretation[];
  synthesis: string;
  model: string;
  tokens_used: number;
  settings: InterpretationSettings;
  created_at?: string; // absent on an unsaved generate result, set once saved
  updated_at?: string;
}
```

```typescript
// src/types/reading.ts
export interface ReadingDetail extends ReadingListItem {
  interpretations: Interpretation[]; // 0–4, at most one per lens
}
```

Old `InterpretationStyle`, `depth`, `tone`, `context`, and `GenerationTuning` types are removed.

## Backend API contract (FastAPI / Gnosis — changes required)

The frontend assumes the following; the backend must implement it before merge.

1. `POST /api/v1/readings` — unchanged from branch Step 1. Saves the bare reading, returns `{ _id }`.
2. `POST /api/v1/readings/{id}/interpretation/generate`
   - Body: `{ "settings": { "lens": "...", "intent": "...", "depth": 60 } }`
   - Returns an **unsaved** `Interpretation` (including echoed `settings`). Does not persist.
   - The backend derives the word budget from `depth` and the reading's card count (see budget model above) and shapes the prompt accordingly.
3. `PUT /api/v1/readings/{id}/interpretations/{lens}`
   - The slot is the resource: lens in the path makes the upsert explicit and idempotent, and enforces per-lens uniqueness by routing.
   - Body: full `Interpretation` (the generate response verbatim). Backend validates `settings.lens` matches the path lens, else `422`.
   - Returns the full updated `interpretations` array so the client refreshes without a second GET.
4. `GET /api/v1/readings/{id}` — returns `interpretations: Interpretation[]` (empty array when none) instead of a single nested `interpretation` / flat fields.
5. Reading list endpoint — unchanged, but should expose whether a reading has any interpretations if the journal list wants a badge (optional, not required this iteration).

### Payload reference

`POST /api/v1/readings` — request:

```json
{
  "spread_name": "Three Card Spread",
  "question": "Will I find love?",
  "birth_date": "1990-03-12",
  "cards": [
    { "name": "The Fool", "position": "Past", "orientation": "upright",
      "position_description": "What came before" },
    { "name": "The Magician", "position": "Present", "orientation": "reversed" }
  ]
}
```

`question` / `birth_date` / `position_description` optional — omitted, never `null`. `cards`: 1–11 items. Response `201`:

```json
{ "_id": "665f2a...", "created_at": "2026-08-21T09:30:00Z" }
```

`POST /api/v1/readings/{id}/interpretation/generate` — request (all three settings fields **required**, no server-side defaults, so stored settings always reflect the user's actual choice):

```json
{ "settings": { "lens": "esoteric", "intent": "predictive", "depth": 60 } }
```

Response `200` (unsaved; `settings` echoed back verbatim so the saved record is self-describing):

```json
{
  "card_interpretations": [
    { "card_name": "The Fool", "position": "Past", "orientation": "upright",
      "interpretation": "..." }
  ],
  "synthesis": "...",
  "model": "claude-sonnet-5",
  "tokens_used": 1834,
  "settings": { "lens": "esoteric", "intent": "predictive", "depth": 60 }
}
```

`PUT /api/v1/readings/{id}/interpretations/{lens}` — body is the generate response verbatim. Response `200`:

```json
{
  "interpretations": [
    { "card_interpretations": ["..."], "synthesis": "...", "model": "...",
      "tokens_used": 1834,
      "settings": { "lens": "esoteric", "intent": "predictive", "depth": 60 },
      "created_at": "2026-08-21T09:31:40Z", "updated_at": "2026-08-21T09:31:40Z" }
  ]
}
```

`GET /api/v1/readings/{id}` — response:

```json
{
  "_id": "665f2a...",
  "spread_name": "Three Card Spread",
  "question": null,
  "birth_date": "1990-03-12",
  "cards": [ { "name": "The Fool", "position": "Past", "orientation": "upright" } ],
  "tags": ["love"],
  "created_at": "2026-08-21T09:30:00Z",
  "interpretations": []
}
```

Conventions:
- Timestamps: UTC ISO-8601; each saved interpretation carries `created_at`/`updated_at` (journal tabs order by `created_at`).
- Enums: `lens` ∈ `traditional | psychological | esoteric | alchemical`; `intent` ∈ `reflective | predictive`; `orientation` ∈ `upright | reversed`; `depth` integer 0–100.
- Errors: one shape, `{ "detail": "human-readable message" }`, with `401` (auth), `404` (not owner / missing), `422` (validation) — `authenticatedFetch` surfaces `detail` as `result.message`.

## Frontend work plan

### Step 1 — Types & validation
- Rework `src/types/interpret.ts` and `src/types/reading.ts` as above.
- `src/lib/validation/interpret-schemas.ts`: replace `interpretationSettingsSchema` (lens enum + intent enum + `depth: z.number().int().min(0).max(100)`), delete `generationTuningSchema` context and `CONTEXT_MAX_LENGTH`; `saveInterpretationSchema` carries the new settings shape.

### Step 2 — Server actions (`src/app/user/interpret/actions.ts`)
- `createReading` — unchanged.
- `generateInterpretation(readingId, settings)` — settings now **required** (lens + intent), validated with the new schema.
- `saveInterpretation(readingId, interpretation)` — now targets `PUT /interpretations/{lens}` (lens taken from `interpretation.settings.lens`), new schema; returns the updated interpretations array.

### Step 3 — Sticky defaults lib
- New `src/lib/interpretation-defaults.ts`: `readDefaultSettings(): InterpretationSettings` (falls back to Traditional + Reflective + depth 60) and `writeDefaultSettings(settings)`, localStorage-backed, SSR-safe, try/catch like the old backup lib.
- New helper `estimatedWordsPerCard(depth, cardCount)` mirroring the backend budget model, for the live hint in the depth control.
- Replaces `src/lib/interpretation-settings.ts` (band labels and `generationInputsChanged` go away; regenerate-guard now = "this lens+intent+depth combination equals the one just generated").

### Step 4 — Settings controls component
- Rewrite `InterpretationSettingsControls.tsx` to match the screenshot, restyled for the app theme (Cinzel/Crimson Pro, gold `#d4af37` accents, dark mystical palette, responsive):
  - **Primary lens**: vertical card list (icon, name, one-line description, check on the selected card), single-select.
  - **Intent**: two-segment toggle with helper text under the selected segment.
  - **Depth**: continuous slider (0–100 range input, gold accent) showing the current percentage and a live "≈ N words per card" hint computed from the reading's card count.
  - Header line: "Applies to every reading until you change it."
- Rewrite `InterpretationSettingsInfo.tsx` copy for lenses + intent (or fold the one-line descriptions into the cards and delete the info modal — decide during implementation; default: delete, the cards are self-describing).

### Step 5 — InterpretationModal rework
- States stay: `generating | preview | tweak | saving | error`.
- Modal opens on **tweak** (lens/intent picker seeded from sticky default, or from the lens being re-generated) — no more auto-generate on mount, since lens choice is now meaningful.
- Preview shows the generated interpretation with its lens+intent badge; **Save** upserts the slot; if the reading already has a saved interpretation for that lens, show a confirm ("Replace your saved Esoteric interpretation?") before saving.
- On successful save: persist lens+intent as the sticky default, close, refresh.
- Keep: unsaved-close confirmation, retry-last-attempt on error, portal/scroll-lock/Escape behavior.

### Step 6 — Journal page (`InterpretationSection`)
- Reading with saved interpretations: **lens tabs** (only saved lenses shown), each tab labeled with lens name + intent badge, rendering `InterpretationDisplay`; footer shows model/tokens for the active tab.
- "✦ New Interpretation ✦" opens the modal; lenses already saved are marked in the picker ("will replace").
- Reading with none: card row + "✦ Oracle Interpretation ✦" button (as on branch).
- Remove all backup/restore UI.

### Step 7 — TarotGame
- Keep the ribbon-save flow and gated "Oracle Interpretation" button as on branch; pass the new modal props. `onSaved` can stay a no-op or show a "saved to journal" hint.

### Step 8 — Removals
- Delete `src/lib/interpretation-backup.ts`, its test file, and `src/lib/interpretation-settings.ts` band-label logic + test coverage that no longer applies.

### Step 9 — Tests & docs
- New unit tests: defaults lib (round-trip, SSR no-op, malformed JSON), new schemas (lens/intent/depth validation), `estimatedWordsPerCard` (depth and card-count scaling), slot-upsert helper if one exists client-side.
- Keep `reading-payload.test.ts`.
- Update `docs/project_notes/issues.md`; supersede the Step 1/Step 2 specs in `docs/specs/` with a pointer to this plan.

## Sequencing / dependencies

1. Backend contract (blocking for everything except Steps 1, 3, 4 which can be built against the agreed shapes).
2. Steps 1–2 (types/schemas/actions) → Step 5 (modal) → Steps 6–7 (pages) → Steps 8–9 (cleanup, tests, docs).

## Open questions

- Depth budget constants: agree `MIN_TOTAL`/`MAX_TOTAL` words (proposal: 150–1200) with the backend so the frontend's words-per-card hint matches reality.
- Naming drift: existing list/detail endpoints return `spread_type` while the create payload sends `spread_name`. Ideal is `spread_name` everywhere, but that touches existing endpoints — decide with the backend whether to unify now or alias.
- Should the journal **list** page badge readings that have interpretations? (Deferred.)
- Icon set for the four lenses (book / brain / star / alembic) — reuse existing glyph style or inline SVGs.
