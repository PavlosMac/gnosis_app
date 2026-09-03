# Remove Interpretation Intent

**Status:** Approved plan
**Date:** 2026-09-02
**Scope:** Frontend only (tarot-divinations)

## Context

Interpreter v2 (`docs/new-interpreter-v2.md`, ADR-004 in `docs/project_notes/decisions.md`) collapsed interpretation settings to `{intent}` (Reflective/Predictive). A same-day amendment then gated that toggle behind a per-spread allowlist (`INTENT_SPREADS`/`spreadAllowsIntent`) since fixed-structure spreads (Elemental, Tree of Life, Significators, Past/Present/Future, Career) don't take it.

**Decided:** drop intent completely — no setting, no toggle, no "Reading Style" affordance, for any spread. This removes the last field of `InterpretationSettings`, so `generateInterpretation`/`saveInterpretation` end up with no tunable parameters at all, and there is no longer a "which spreads allow intent" list to maintain — the allowlist and everything that consulted it goes away with it.

**Also decided:** no replacement "Regenerate" action. The interpretation modal generates once per open; to try again the user closes and reopens it via the existing entry points ("✦ Oracle Interpretation ✦" in-game, "✦ New Interpretation ✦" on the journal page).

## Files deleted entirely

- `src/components/ReadingStyleModal.tsx` — its whole purpose was hosting the intent toggle.
- `src/components/InterpretationSettingsControls.tsx` — the Reflective/Predictive radiogroup; nothing else lived here.
- `src/lib/interpretation-defaults.ts` — every export (`INTENT_LABELS`, `DEFAULT_INTENT`, `INTENT_SPREADS`, `spreadAllowsIntent`, `readDefaultIntent`, `writeDefaultIntent`) is intent machinery; nothing survives.
- `src/lib/__tests__/interpretation-defaults.test.ts` — tests only the above.

## Changes

1. **`src/types/interpret.ts`** — remove `INTENTS`, `InterpretationIntent`, `InterpretationSettings`; drop the `settings` field from `Interpretation`.

2. **`src/lib/validation/interpret-schemas.ts`** — remove `interpretationSettingsSchema` and the `INTENTS` import; drop `settings` from `saveInterpretationSchema` (zod strips it harmlessly if a legacy/backend payload still carries it — no need to keep it just for tolerance).

3. **`src/app/user/interpret/actions.ts`** — `generateInterpretation(readingId: string)`: drop the `settings` parameter and its schema validation; POST with no settings payload (check `authenticatedFetch` in `src/lib/api-client.ts` for whether an empty/omitted body is idiomatic there). `saveInterpretation` is otherwise unchanged — it just validates a smaller schema now.

4. **`src/components/InterpretationModal.tsx`** — remove all intent state (`intent`, `lastGenerated`, `allowsIntent`, the `readDefaultIntent`/`writeDefaultIntent`/`spreadAllowsIntent`/`INTENT_LABELS`/`InterpretationSettingsControls` imports, `initialIntent` prop). The pre-generate state (currently `"tweak"`) becomes a plain confirm screen — a short line plus the "✦ Consult the Oracle ✦" button — with no settings UI and no `disabled` condition tied to settings equality. Since there is no regenerate path back into it, also drop the now-unreachable "Back to preview" button and the `unsavedResult && (...)` branch inside that state. Preview state loses its intent caption and the "Tune & Regenerate" button entirely (it was already gated to only ever show for allowlisted spreads, so removing it changes nothing observable for the other 5 spreads). The error state's "Try Again" keeps calling generate directly, unaffected. Rename `"tweak"` → `"confirm"` and `generateTuned` → a plainer name, since "tuning" no longer applies.
   `onSaved` can drop its `Interpretation` argument (`() => void`) — nothing downstream reads it once intent-sync is gone.

5. **`src/components/TarotGame.tsx`** — remove the `showStyleModal` state, `handleCloseStyleModal`, the "◈ Reading Style" button block (including its locked/🔒 variant), the `ReadingStyleModal` import and render, the `intent` state and its mount-effect seed, and the `initialIntent` prop passed to `InterpretationModal`. `handleInterpretationSaved` drops the `if (saved.settings.intent) setIntent(...)` line — it becomes just the `router.push` on save.

6. **`src/app/user/readings/[id]/InterpretationSection.tsx`** — remove the `INTENT_LABELS` import and the intent-label caption block above the saved interpretation.

7. **Tests** — `src/lib/__tests__/interpret-schemas.test.ts`: delete the `interpretationSettingsSchema` describe block; drop `settings` from the `saveInterpretationSchema` fixtures and remove/replace the now-inapplicable "requires settings" test.

8. **Docs** — append a second amendment under ADR-004 in `docs/project_notes/decisions.md` stating intent is fully removed (superseding the per-spread-allowlist amendment); log the change in `docs/project_notes/issues.md`. Leave the historical planning docs (`docs/new-interpreter-v2.md`, `docs/manual-entry-flow.md`, `docs/multi-lens-interpretations.md`) untouched — they're a historical record, consistent with how the prior amendment was handled.

## Verification

1. `npx tsc --noEmit` (ignore the pre-existing stale `.next/dev` validator error for the unrelated `/cards` route), `npx vitest run`, `npm run build`. (`npm run lint` is broken repo-wide, pre-existing.)
2. `grep -rn "intent\|Intent\|INTENT" src` should return no hits (spot-check for stragglers; the RNG-explainer prose "...at the precise moment your intention met the unknown" in `TarotGame.tsx` is unrelated copy and stays).
3. Manual: on `/reading`, no "Reading Style" button appears for any spread; on a saved reading's journal page and in-game, the interpretation modal opens straight to a plain "Consult the Oracle" confirm screen, generates once, and the saved narrative shows with no intent caption.
