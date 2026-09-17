# Manual Reading Page + "Reading Style" Modal — Design & Plan

Date: 2026-08-21
Status: Feature 2 (Reading Style) completed 2026-08-21; Feature 1 (Manual Reading, profile label "Manual Interpretation") completed 2026-08-25.

## Context

Two features for the tarot game:

1. **Manual Reading** — a separate path from the user's profile (not part of the normal reading setup): a page where the user re-creates a spread they already pulled with a physical deck. It looks like the normal spread flow, but there is **no random algorithm** — the deck is shown **face-up** and the user picks their exact cards. It hooks into the same save + "get interpretation" flow.
2. **Reading Style** — a button labeled "Reading Style" at the **top right** of the game screen that opens a **modal** with the lens/intent/depth controls. Style is chosen whenever the user wants (not forced at the end); clicking "✦ Oracle Interpretation ✦" then generates immediately with those settings (tweak stays reachable via "Tune & Regenerate"). The journal detail page keeps its current tweak-first modal flow — no changes there.

Confirmed decisions: reuse `TarotGame` with a `mode="manual"` prop; per-card upright/reversed control lives in a **tray above the face-up deck**; interpretation modal auto-generates when opened from the game.

## Feature 1 — Manual Reading

### Reducer — `src/hooks/useGameReducer.ts`

New phase: `{ phase: 'manual-select'; selectedCards: SelectedCard[] }`.

New actions (each guarded to no-op outside its valid phase, matching the `SELECT_CARD` guard style):

```ts
| { type: 'START_MANUAL_ENTRY' }                              // from 'setup'
| { type: 'MANUAL_ADD_CARD'; card: SelectedCard; numCards: number }
| { type: 'MANUAL_TOGGLE_ORIENTATION'; cardIdx: number }      // canonical deck idx
| { type: 'MANUAL_REMOVE_CARD'; cardIdx: number }
| { type: 'MANUAL_COMPLETE'; positions: string[]; readingName: string;
    question?: string; positionDescriptions?: Record<string, string> }
```

- `MANUAL_ADD_CARD`: no-op if already at `numCards` or same `idx` picked; append only — never auto-finalizes (user can still fix the last card).
- `MANUAL_TOGGLE_ORIENTATION` / `MANUAL_REMOVE_CARD`: map/filter by `idx`; removal renumbers positions implicitly (positions derive from array order, visible in the tray).
- `MANUAL_COMPLETE`: no-op unless `selectedCards.length === positions.length`; builds the positions record + `ReadingResult` exactly like the final `SELECT_CARD` branch and lands **directly in `phase: 'reading'`** — cards are already face-up, so `flipping` is skipped (`BIRTHDATE_SUBMIT` is the precedent).
- Extract the positions-record + `ReadingResult` construction from `SELECT_CARD` into a module-level `buildReading(...)` helper used by both branches.
- Export `gameReducer` for unit tests.

**`SelectedCard.idx` = canonical deck idx (0-77) in manual mode.** Verified safe: nothing outside `ShuffledDeck.tsx` depends on shuffled-position semantics (`Reading.tsx` zips by array order; `buildReadingPayload` uses only name/reversed), and `ShuffledDeck` never mounts in manual mode.

### New component — `src/components/FaceUpDeck.tsx`

Same visual layout as `ShuffledDeck` (flex-wrap grid, same `max-w-[400px] sm:max-w-[856px]`, card sizing, hover scale/glow idioms) but:

- `MANUAL_DECK_ORDER` (`src/lib/cards.ts`, derived from `TAROT_DECK`): Majors 0-21 → Ace–10 of Wands, Cups, Swords, Pentacles → court cards grouped by suit in that same order, each as Knight, Queen, King, Page — no `secureShuffleArray`, no `getSecureRandomBoolean`. Reversal is set only from the tray (no on-card toggle).
- Front face (card image) always visible; no flip animation.
- Tap an unselected card → `onAddCard({ ...card, reversed: false })`; a picked card gets a gold ring + position badge and dims; tapping it again unselects. Once `numCards` are picked, remaining cards dim/disable.
- **Sticky tray above the deck** (gradient background idiom from `InterpretationModal`'s sticky header): progress line "Choose card 2 of 3 — Present"; picked-card chips in position order, each with thumbnail, name, ⤾ reverse toggle (`rotate-180` on the image), and × remove; "✦ Reveal the Reading ✦" gold-gradient button (disabled until complete) and "◇ Go Back ◇" (→ `RESET`).
- Props: `{ numCards, positions, selectedCards, onAddCard, onRemoveCard, onToggleOrientation, onComplete, onCancel }`.
- Responsive; `aria-pressed` + descriptive `aria-label` ("The Fool — selected for Present, reversed").

### Route + profile entry

- **New `src/app/user/manual-reading/page.tsx`** (server component): `getCurrentUser()`, `redirect("/user/login")` if absent (proxy also guards `/user/*`); page shell mirrors `src/app/reading/page.tsx` (starfield + fonts + `overflow-y-auto`), back button → `/user/profile` labeled "Sanctum"; renders `<TarotGame user={user} mode="manual" />`.
- **`src/app/user/profile/page.tsx`**: add a "Manual Interpretation" link row (exact idiom of the Readings Journal row) → `/user/manual-reading`.

### TarotGame changes (Feature 1)

- New prop `mode?: 'draw' | 'manual'` (default `'draw'`).
- Setup screen in manual mode: same spread picker + question input; **hide the reversals pill** (orientation is per-card in the tray); **exclude Significators** (`cards === 0`) from the spread options — it's birthdate-computed, manual entry is meaningless.
- `startGame`: `mode === 'manual'` → `START_MANUAL_ENTRY` (no shuffle animation).
- Fix `isSelecting` to exclude `'manual-select'` — otherwise the new phase would render `ShuffledDeck`.
- New `game.phase === 'manual-select'` render branch mounting `FaceUpDeck` with memoized callbacks; complete dispatches `MANUAL_COMPLETE` with `positionNames`, `selectedReading.name`, question (same `showQuestion` guard), `positionDescriptions`.

Downstream — save ribbon, `saveReading`/`createReading`, `cardVisuals`, `Reading.tsx` layouts, `InterpretationModal` — unchanged: `completedReading` is shape-identical. `interpretRequestSchema` caps cards at 11 = Tree of Life, fine.

## Feature 2 — Reading Style button + modal

### New component — `src/components/ReadingStyleModal.tsx`

Portal modal (shell styling borrowed from `InterpretationModal`: backdrop blur, gradient panel, gold border, sticky header "✦ Reading Style ✦", Escape/backdrop close). Body renders the existing **`InterpretationSettingsControls` unchanged** (`savedLenses` omitted) + a "Done" button. Props: `{ settings, onSettingsChange, cardCount, onClose }`. Changes apply to state immediately; no separate save step.

### TarotGame changes (Feature 2)

- Top-right button "◈ Reading Style" rendered by TarotGame (`absolute top-4 right-4 z-50`, text-button idiom of the Portal back link on the reading page) so it appears on both `/reading` and, later, `/user/manual-reading`, in every phase. Opens `ReadingStyleModal`.
- Settings state: `useState(DEFAULT_SETTINGS)` + mount `useEffect` seeding from `readDefaultSettings()` — **not** a lazy initializer (setup screen server-renders; a lazy localStorage read risks hydration mismatch). Persist-on-change `useEffect` calling `writeDefaultSettings` (skip first run via ref) — keeps the game, the game's interpretation modal, and the journal modal in agreement via the existing sticky-default mechanism (`src/lib/interpretation-defaults.ts`).
- `cardCount` for the style modal: `selectedReading.cards || selectedReading.positions.length` (Significators → 4).

### `src/components/InterpretationModal.tsx` — two optional props

```ts
initialSettings?: InterpretationSettings;  // default: readDefaultSettings()
autoGenerate?: boolean;                    // default false → opens in "tweak" as today
```

- `tunedSettings` init: `initialSettings ?? readDefaultSettings()`; `modalState` init: `autoGenerate ? "generating" : "tweak"` (spinner on first paint, no tweak flash).
- Mount effect: if `autoGenerate`, set `lastAttemptRef.current = generateTuned` and run `runGenerate(tunedSettings)` once (fired-once ref; `isFetchingRef` absorbs StrictMode's double effect). "Try Again" works via `lastAttemptRef`; "Tune & Regenerate" untouched.
- TarotGame's modal mount gains `initialSettings={interpretationSettings}` and `autoGenerate`. Accepted edge: reopening the modal regenerates (confirmed UX; the lens-replace confirm already guards duplicate saves).
- `InterpretationSection.tsx` (journal) passes neither prop → journal flow identical; no changes to that file.

## Files

| File | Feature | Change |
|---|---|---|
| `src/hooks/useGameReducer.ts` | 1 | new phase + 5 actions, `buildReading` helper, export `gameReducer` |
| `src/hooks/__tests__/useGameReducer.test.ts` | 1 | new vitest suite |
| `src/components/FaceUpDeck.tsx` | 1 | new — face-up deck grid + sticky tray |
| `src/app/user/manual-reading/page.tsx` | 1 | new — auth-gated page, `<TarotGame mode="manual">` |
| `src/app/user/profile/page.tsx` | 1 | add "Manual Reading" link row |
| `src/components/ReadingStyleModal.tsx` | 2 | new — settings modal wrapper |
| `src/components/TarotGame.tsx` | 1+2 | `mode` prop, manual branches, `isSelecting` fix; Reading Style button + settings state, modal props |
| `src/components/InterpretationModal.tsx` | 2 | `initialSettings`/`autoGenerate` props + auto-generate mount effect |

Reuse, don't rebuild: `TAROT_DECK` (`src/lib/cards.ts`), ShuffledDeck's grid/card markup idioms, `InterpretationSettingsControls`, `readDefaultSettings`/`writeDefaultSettings`/`DEFAULT_SETTINGS`, `buildReadingPayload` (untouched), profile link-row idiom.

## Tests

New reducer suite (Feature 1): `START_MANUAL_ENTRY` from setup only; `ADD` dedups by idx and caps at numCards; `TOGGLE` flips only the match; `REMOVE` preserves order of the rest; `COMPLETE` no-ops when incomplete, builds correct positions record/question/positionDescriptions and lands in `reading` when complete; manual actions no-op outside `manual-select`; existing `SELECT_CARD`/`BIRTHDATE_SUBMIT` regressions covering the `buildReading` extraction.

## Verification

1. `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
2. Manual QA:
   - Normal draw flow unchanged for every spread incl. Significators and Tree of Life.
   - Profile → Manual Reading → pick spread + question → face-up deck: pick/unpick, reverse and remove via tray, Reveal → reading renders in correct position order → save → interpret; journal entry shows correct orientations.
   - Reading Style button: change lens/depth, close, reload page (stickiness via localStorage), complete a reading, Oracle Interpretation → immediate spinner → preview matches chosen settings → Tune & Regenerate still works.
   - Journal detail page modal still opens in tweak state.
   - 375px viewport: deck + tray usable at 11 cards, no horizontal overflow; Reading Style button doesn't collide with the top-left Portal/Sanctum link.
