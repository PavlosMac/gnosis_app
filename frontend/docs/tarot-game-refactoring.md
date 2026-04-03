# TarotGame Refactoring Plan

## Context

TarotGame.tsx is a 330-line orchestrator component with 10 `useState` hooks, 5 `useEffect` hooks, and an implicit state machine expressed as boolean soup. Surrounding components duplicate interfaces and nearly-identical UI. This makes the module fragile to modify — adding a new game phase or changing transition logic requires careful coordination across multiple booleans and effects.

## Anti-Patterns Found

### 1. Boolean Soup State Machine (High Impact)
`gameStarted`, `isShuffling`, `showReading`, `showInterpretModal` form an implicit state machine with invalid combinations possible. Five `useEffect` hooks coordinate transitions between phases.

### 2. `SelectedCard` Interface Defined 5 Times (DRY Violation)
Canonical definition exists at `src/types/reading.ts`, but local copies exist in:
- `src/components/Reading.tsx`
- `src/components/ShuffledDeck.tsx`
- `src/components/ShuffledDeckMobile.tsx`
- `src/components/KabbalahLayout.tsx`

### 3. ShuffledDeck & ShuffledDeckMobile Are ~95% Identical
Same state, same `handleSelect`, same card rendering. Only differ in sizing classes, hover vs active effects, and scroll-on-mount behavior. The `useIsMobile` hook in TarotGame exists solely to switch between them.

### 4. Ornate Corner Decorations Duplicated
Identical 4-corner border pattern in TarotGame and InterpretationModal (differing only in size: `w-24 h-24` vs `w-16 h-16`).

### 5. `useIsMobile` Hook Defined Inline
Custom hook co-located inside TarotGame.tsx instead of being shared.

---

## Refactoring Steps

### Step 1: Deduplicate `SelectedCard` imports
- Delete local `SelectedCard` interfaces from Reading.tsx, ShuffledDeck.tsx, ShuffledDeckMobile.tsx, KabbalahLayout.tsx
- Import from `@/types/reading` in all four files
- **Files:** `src/components/Reading.tsx`, `src/components/ShuffledDeck.tsx`, `src/components/ShuffledDeckMobile.tsx`, `src/components/KabbalahLayout.tsx`

### Step 2: Merge ShuffledDeck and ShuffledDeckMobile into one responsive component
- Merge into a single `ShuffledDeck.tsx` that uses Tailwind responsive classes (`sm:`) instead of runtime `useIsMobile` switching
- Desktop sizing: `clamp(40px, 5vw, 60px)` with aspect-ratio 5:8, hover effects
- Mobile sizing: `clamp(32px, 9vw, 64px)` with explicit height, active-only effects
- Remove `ShuffledDeckMobile.tsx`
- Remove `useIsMobile` hook and `isMobile` conditional from TarotGame.tsx
- **Files:** `src/components/ShuffledDeck.tsx` (modify), `src/components/ShuffledDeckMobile.tsx` (delete), `src/components/TarotGame.tsx` (simplify)

### Step 3: Extract `OrnateFrame` component
- Create `src/components/OrnateFrame.tsx` — a wrapper that renders the 4 corner borders + optional glow effect
- Accept `size` prop (`"sm" | "md"`) for the corner dimensions
- Use in TarotGame.tsx and InterpretationModal.tsx
- **Files:** `src/components/OrnateFrame.tsx` (new), `src/components/TarotGame.tsx`, `src/components/InterpretationModal.tsx`

### Step 4: Extract `useGameReducer` — explicit state machine for TarotGame
Replace the 10 `useState` + 5 `useEffect` tangle with a `useReducer` state machine.

**Game phases (discriminated union):**
```typescript
type GamePhase =
  | { phase: 'setup' }                                          // reading type selection
  | { phase: 'shuffling' }                                      // shuffle animation
  | { phase: 'selecting'; selectedCards: SelectedCard[] }        // picking cards from deck
  | { phase: 'reading'; selectedCards: SelectedCard[]; reading: ReadingResult }  // viewing the reading
```

**Separate concerns kept as local state in TarotGame:**
- `selectedReading` / `userQuestion` — form inputs (stay as useState)
- `showInterpretModal` / `interpretResult` / `remainingCredits` — interpretation feature (stay as useState)

**Actions:**
```typescript
type GameAction =
  | { type: 'START_SHUFFLE' }
  | { type: 'SHUFFLE_COMPLETE' }
  | { type: 'SELECT_CARD'; card: SelectedCard }
  | { type: 'SHOW_READING'; reading: ReadingResult }
  | { type: 'RESET' }
```

**Scroll effects** move into a single `useEffect` that reacts to `phase` transitions instead of scattered boolean watchers.

- **Files:** `src/hooks/useGameReducer.ts` (new), `src/components/TarotGame.tsx` (major simplification)

### Step 5: Extract `useIsMobile` to shared hooks (if still needed)
- After Step 2, `useIsMobile` may no longer be needed in TarotGame (responsive CSS handles it)
- If it's still used for the header visibility toggle (`hidden sm:block`), extract to `src/hooks/useIsMobile.ts`
- **Files:** `src/hooks/useIsMobile.ts` (new, if needed)

---

## Files Modified Summary

| File | Action |
|------|--------|
| `src/types/reading.ts` | No change (canonical) |
| `src/components/Reading.tsx` | Remove local SelectedCard, import from types |
| `src/components/ShuffledDeck.tsx` | Merge mobile variant in, use responsive CSS |
| `src/components/ShuffledDeckMobile.tsx` | **Delete** |
| `src/components/KabbalahLayout.tsx` | Remove local SelectedCard, import from types |
| `src/components/OrnateFrame.tsx` | **New** — reusable ornate corner wrapper |
| `src/components/InterpretationModal.tsx` | Use OrnateFrame |
| `src/hooks/useGameReducer.ts` | **New** — game state machine |
| `src/hooks/useIsMobile.ts` | **New** (only if still needed after Step 2) |
| `src/components/TarotGame.tsx` | Major simplification — use reducer + OrnateFrame + unified deck |

---

## Verification

1. `npm run build` — no type errors
2. `npm run lint` — no lint errors
3. Manual test: navigate to `/reading`, select a reading type, complete a full game cycle (shuffle → select cards → view reading → new reading)
4. Manual test: verify mobile layout works (dev tools responsive mode)
5. Manual test: logged-in user — verify "Oracle Interpretation" button + modal still works
6. Verify ornate corners render correctly in both TarotGame and InterpretationModal
