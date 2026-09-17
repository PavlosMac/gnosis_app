# Decoupled Interpretation Flow — Step 2 Frontend (Tuning Controls) Implementation Plan

> **Superseded (2026-08-21):** see `docs/multi-lens-interpretations.md` — lens/intent/depth settings, one interpretation slot per lens, backup/restore dropped.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Step 2 tuning UI — style presets + depth/tone sliders + context field in a modal "tweak" state, with the `lastGenerated` regenerate guard — on top of the shipped Step 1 flow.

**Architecture:** A pure-logic module (`interpretation-settings.ts`) owns band labels, defaults, and the changed-inputs comparison. A shared `InterpretationSettingsControls` component renders the controls (profile page reuses it in Step 3). `generateInterpretation` gains an optional tuning parameter. The modal gains a `tweak` state: preview's "Regenerate" becomes "Tune & Regenerate"; a detail-page host with a saved interpretation opens directly in tweak (no auto-generate, no wasted LLM call), baselined on the saved `settings`/`context`.

**Tech Stack:** unchanged (Next.js 16, React 19, TS strict, Zod 4, Tailwind 4, vitest).

## Global Constraints

- Generate request body (all optional): `{ settings: { style, depth, tone }, context }`; the tweak UI always sends the full `settings` object (its controls are always fully populated) plus `context` when non-empty. First generate still sends no body.
- The response's `settings` are the resolved values actually used — pre-fill controls from the response, never from local assumptions. `context` is NOT echoed; keep the typed value locally.
- Save body: unchanged echo + `context` when one was used. Re-saving without context clears the stored one (full replace) — so attach the typed context to the unsaved result object.
- Regenerate guard is frontend-only: disable until settings or context differ from what produced the visible interpretation.
- Bands (display-only, raw ints are sent): depth 0–25 brief / 26–50 standard / 51–75 detailed / 76–100 comprehensive; tone 0–33 gentle / 34–66 balanced / 67–100 direct.
- Context input maxlength 100 (`CONTEXT_MAX_LENGTH` already in `src/lib/validation/interpret-schemas.ts`).
- Style control: segmented, `practical | reflective | spiritual | esoteric`.
- No commits until FE+BE manual verification passes (user instruction).
- Theme: gold `#d4af37` / purple `#8a2be2`, Cinzel/Crimson Pro, responsive.

---

### Task 1: Pure settings logic — bands, defaults, changed-inputs comparison

**Files:**
- Create: `src/lib/interpretation-settings.ts`
- Test: `src/lib/__tests__/interpretation-settings.test.ts`

**Interfaces:**
- Produces:
  - `DEFAULT_SETTINGS: InterpretationSettings` = `{ style: "reflective", depth: 60, tone: 50 }`
  - `depthBandLabel(depth: number): string` → brief/standard/detailed/comprehensive
  - `toneBandLabel(tone: number): string` → gentle/balanced/direct
  - `GenerationInputs = { settings: InterpretationSettings; context: string }` (context normalized to trimmed string, "" = none)
  - `generationInputsChanged(current: GenerationInputs, baseline: GenerationInputs): boolean`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from "vitest";
import {
  DEFAULT_SETTINGS,
  depthBandLabel,
  toneBandLabel,
  generationInputsChanged,
} from "@/lib/interpretation-settings";

describe("band labels", () => {
  it("maps depth bands", () => {
    expect(depthBandLabel(0)).toBe("brief");
    expect(depthBandLabel(25)).toBe("brief");
    expect(depthBandLabel(26)).toBe("standard");
    expect(depthBandLabel(50)).toBe("standard");
    expect(depthBandLabel(51)).toBe("detailed");
    expect(depthBandLabel(75)).toBe("detailed");
    expect(depthBandLabel(76)).toBe("comprehensive");
    expect(depthBandLabel(100)).toBe("comprehensive");
  });

  it("maps tone bands", () => {
    expect(toneBandLabel(0)).toBe("gentle");
    expect(toneBandLabel(33)).toBe("gentle");
    expect(toneBandLabel(34)).toBe("balanced");
    expect(toneBandLabel(66)).toBe("balanced");
    expect(toneBandLabel(67)).toBe("direct");
    expect(toneBandLabel(100)).toBe("direct");
  });
});

describe("generationInputsChanged", () => {
  const baseline = { settings: DEFAULT_SETTINGS, context: "" };

  it("is false for identical inputs", () => {
    expect(
      generationInputsChanged(
        { settings: { ...DEFAULT_SETTINGS }, context: "" },
        baseline
      )
    ).toBe(false);
  });

  it("detects a settings change", () => {
    expect(
      generationInputsChanged(
        { settings: { ...DEFAULT_SETTINGS, depth: 20 }, context: "" },
        baseline
      )
    ).toBe(true);
  });

  it("detects a context change and ignores surrounding whitespace", () => {
    expect(
      generationInputsChanged(
        { settings: { ...DEFAULT_SETTINGS }, context: "recently divorced" },
        baseline
      )
    ).toBe(true);
    expect(
      generationInputsChanged(
        { settings: { ...DEFAULT_SETTINGS }, context: "  " },
        baseline
      )
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → cannot resolve module.

- [ ] **Step 3: Implement**

```typescript
import type { InterpretationSettings } from "@/types/interpret";

export const DEFAULT_SETTINGS: InterpretationSettings = {
  style: "reflective",
  depth: 60,
  tone: 50,
};

const DEPTH_BANDS: Array<{ max: number; label: string }> = [
  { max: 25, label: "brief" },
  { max: 50, label: "standard" },
  { max: 75, label: "detailed" },
  { max: 100, label: "comprehensive" },
];

const TONE_BANDS: Array<{ max: number; label: string }> = [
  { max: 33, label: "gentle" },
  { max: 66, label: "balanced" },
  { max: 100, label: "direct" },
];

const bandLabel = (bands: Array<{ max: number; label: string }>, value: number): string =>
  (bands.find((band) => value <= band.max) ?? bands[bands.length - 1]).label;

export const depthBandLabel = (depth: number): string => bandLabel(DEPTH_BANDS, depth);

export const toneBandLabel = (tone: number): string => bandLabel(TONE_BANDS, tone);

export interface GenerationInputs {
  settings: InterpretationSettings;
  context: string;
}

export const generationInputsChanged = (
  current: GenerationInputs,
  baseline: GenerationInputs
): boolean =>
  current.settings.style !== baseline.settings.style ||
  current.settings.depth !== baseline.settings.depth ||
  current.settings.tone !== baseline.settings.tone ||
  current.context.trim() !== baseline.context.trim();
```

- [ ] **Step 4: Run to verify pass** — `npm test`.

---

### Task 2: Extend `generateInterpretation` with optional tuning

**Files:**
- Modify: `src/lib/validation/interpret-schemas.ts`
- Modify: `src/app/user/interpret/actions.ts` (`generateInterpretation`)

**Interfaces:**
- Produces: `generateInterpretation(readingId: string, tuning?: GenerationTuning)` where `GenerationTuning = { settings: InterpretationSettings; context?: string }` (exported from `src/types/interpret.ts`). No-tuning calls behave exactly as Step 1 (empty body).

- [ ] **Step 1: Add the type**

In `src/types/interpret.ts`, after `Interpretation`:

```typescript
export interface GenerationTuning {
  settings: InterpretationSettings;
  context?: string;
}
```

- [ ] **Step 2: Add the schema**

In `src/lib/validation/interpret-schemas.ts`:

```typescript
export const generationTuningSchema = z.object({
  settings: interpretationSettingsSchema,
  context: z.string().trim().max(CONTEXT_MAX_LENGTH).optional(),
});
```

- [ ] **Step 3: Extend the action**

Replace `generateInterpretation` in `src/app/user/interpret/actions.ts`:

```typescript
export const generateInterpretation = async (
  readingId: string,
  tuning?: GenerationTuning
): Promise<GenerateInterpretationResult> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: NOT_LOGGED_IN };

  let body = {};
  if (tuning) {
    const parsed = generationTuningSchema.safeParse(tuning);
    if (!parsed.success)
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings." };
    body = {
      settings: parsed.data.settings,
      ...(parsed.data.context && { context: parsed.data.context }),
    };
  }

  const result = await authenticatedFetch<Interpretation>(
    `/api/v1/readings/${readingId}/interpretation/generate`,
    { method: "POST", body: JSON.stringify(body) }
  );

  if (!result.ok)
    return { ok: false, error: result.message ?? "The oracle could not be reached." };

  return { ok: true, data: result.data };
};
```

Add `GenerationTuning` to the type import list and `generationTuningSchema` to the schema import.

- [ ] **Step 4: Verify** — `npm run build && npm test`.

---

### Task 3: `InterpretationSettingsControls` shared component

**Files:**
- Create: `src/components/InterpretationSettingsControls.tsx`

**Interfaces:**
- Props: `{ settings: InterpretationSettings; context: string; onSettingsChange: (s: InterpretationSettings) => void; onContextChange: (c: string) => void; disabled?: boolean }`. Controlled component, no internal state. Profile page reuses it in Step 3 (context row hidden there via a future prop — NOT added now, YAGNI).

- [ ] **Step 1: Implement**

Style: 4 segmented buttons (same pattern as the reversals pill in `TarotGame.tsx:260-285`). Sliders: native `range` inputs with gold accent, band label + raw value beside each. Context: textarea with live counter (`maxLength={CONTEXT_MAX_LENGTH}`).

```tsx
"use client";

import React from "react";
import { CONTEXT_MAX_LENGTH } from "@/lib/validation/interpret-schemas";
import { depthBandLabel, toneBandLabel } from "@/lib/interpretation-settings";
import type {
  InterpretationSettings,
  InterpretationStyle,
} from "@/types/interpret";

const STYLES: InterpretationStyle[] = [
  "practical",
  "reflective",
  "spiritual",
  "esoteric",
];

const SLIDER_MIN = 0;
const SLIDER_MAX = 100;

interface InterpretationSettingsControlsProps {
  settings: InterpretationSettings;
  context: string;
  onSettingsChange: (settings: InterpretationSettings) => void;
  onContextChange: (context: string) => void;
  disabled?: boolean;
}

const InterpretationSettingsControls: React.FC<InterpretationSettingsControlsProps> = ({
  settings,
  context,
  onSettingsChange,
  onContextChange,
  disabled,
}) => (
  <div className="flex flex-col gap-6">
    {/* Style */}
    <div>
      <span
        className="block text-xs text-[#d4af37]/60 tracking-[0.2em] uppercase mb-2"
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        Style
      </span>
      <div
        role="group"
        aria-label="Interpretation style"
        className="grid grid-cols-2 sm:grid-cols-4 border-2 border-[#d4af37]/30 rounded-lg overflow-hidden bg-[#0a0015]/40"
      >
        {STYLES.map((style) => (
          <button
            key={style}
            type="button"
            disabled={disabled}
            aria-pressed={settings.style === style}
            onClick={() => onSettingsChange({ ...settings, style })}
            className={`py-2.5 px-2 text-center text-[11px] sm:text-xs tracking-[0.1em] uppercase transition-all duration-300
              ${settings.style === style
                ? 'bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] font-bold'
                : 'text-[#e6d5b8]/60 hover:text-[#e6d5b8]/90 hover:bg-[#d4af37]/10'}
              disabled:cursor-not-allowed`}
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {style}
          </button>
        ))}
      </div>
    </div>

    {/* Depth */}
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span
          className="text-xs text-[#d4af37]/60 tracking-[0.2em] uppercase"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          Depth
        </span>
        <span
          className="text-xs text-[#e6d5b8]/70"
          style={{ fontFamily: "'Crimson Pro', serif" }}
        >
          {depthBandLabel(settings.depth)} · {settings.depth}
        </span>
      </div>
      <input
        type="range"
        min={SLIDER_MIN}
        max={SLIDER_MAX}
        value={settings.depth}
        disabled={disabled}
        onChange={(e) => onSettingsChange({ ...settings, depth: Number(e.target.value) })}
        className="w-full accent-[#d4af37] disabled:cursor-not-allowed"
        aria-label="Depth"
      />
    </div>

    {/* Tone */}
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span
          className="text-xs text-[#d4af37]/60 tracking-[0.2em] uppercase"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          Tone
        </span>
        <span
          className="text-xs text-[#e6d5b8]/70"
          style={{ fontFamily: "'Crimson Pro', serif" }}
        >
          {toneBandLabel(settings.tone)} · {settings.tone}
        </span>
      </div>
      <input
        type="range"
        min={SLIDER_MIN}
        max={SLIDER_MAX}
        value={settings.tone}
        disabled={disabled}
        onChange={(e) => onSettingsChange({ ...settings, tone: Number(e.target.value) })}
        className="w-full accent-[#d4af37] disabled:cursor-not-allowed"
        aria-label="Tone"
      />
    </div>

    {/* Context */}
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label
          htmlFor="interpretation-context"
          className="text-xs text-[#d4af37]/60 tracking-[0.2em] uppercase"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          Context
        </label>
        <span
          className="text-xs text-[#e6d5b8]/50"
          style={{ fontFamily: "'Crimson Pro', serif" }}
        >
          {context.length}/{CONTEXT_MAX_LENGTH}
        </span>
      </div>
      <textarea
        id="interpretation-context"
        rows={2}
        maxLength={CONTEXT_MAX_LENGTH}
        value={context}
        disabled={disabled}
        onChange={(e) => onContextChange(e.target.value)}
        placeholder="Anything the oracle should know about your situation (optional)"
        className="w-full border-2 border-[#d4af37]/30 rounded-lg px-3 py-2 bg-[#1a0033]/80 text-[#e6d5b8] text-sm
                   focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30 transition-all
                   placeholder:text-[#e6d5b8]/40 resize-none disabled:cursor-not-allowed"
        style={{ fontFamily: "'Crimson Pro', serif" }}
      />
    </div>
  </div>
);

export default InterpretationSettingsControls;
```

- [ ] **Step 2: Verify** — `npm run build` (component compiles; rendered in Task 4).

---

### Task 4: Modal tweak state + regenerate guard

**Files:**
- Modify: `src/components/InterpretationModal.tsx`

**Behavior:**
- `ModalState` gains `"tweak"`.
- New state: `tunedSettings: InterpretationSettings`, `tunedContext: string`, `lastGenerated: GenerationInputs | null`.
- **Mount:** if `savedInterpretation` exists → open in `tweak`, controls pre-filled from `savedInterpretation.settings` / `.context ?? ""`, `lastGenerated` = those values (guard blocks regenerating the identical thing). Otherwise → auto-generate with no tuning (Step 1 behavior).
- **After any successful generate:** pre-fill controls from `result.data.settings` (resolved server-side — trust the echo), keep the typed context; set `lastGenerated = { settings: result.data.settings, context: sentContext }`; attach the typed context to the unsaved result (`{ ...result.data, ...(sentContext && { context: sentContext }) }`) so the save body carries it; show `preview`.
- **Preview buttons:** "✦ Save Interpretation ✦" (unchanged) + "Tune & Regenerate" → `tweak`.
- **Tweak state:** `InterpretationSettingsControls` + primary "✦ Regenerate ✦" disabled unless `generationInputsChanged({ settings: tunedSettings, context: tunedContext }, lastGenerated)` (enabled when `lastGenerated` is null — first generate from a saved baseline counts changes against the saved inputs which ARE `lastGenerated`, so null never happens in tweak; guard defensively anyway) + a "Back to preview" link shown only when `unsavedResult` exists.
- Close guard, save flow, error state: unchanged.

- [ ] **Step 1: Implement** — replace the component internals:

Imports to add:

```typescript
import InterpretationSettingsControls from "@/components/InterpretationSettingsControls";
import {
  DEFAULT_SETTINGS,
  generationInputsChanged,
  type GenerationInputs,
} from "@/lib/interpretation-settings";
import type { Interpretation, InterpretationSettings } from "@/types/interpret";
```

State/initialization changes:

```typescript
type ModalState = "generating" | "preview" | "tweak" | "saving" | "error";

const [modalState, setModalState] = useState<ModalState>(
  savedInterpretation ? "tweak" : "generating"
);
const [tunedSettings, setTunedSettings] = useState<InterpretationSettings>(
  savedInterpretation?.settings ?? DEFAULT_SETTINGS
);
const [tunedContext, setTunedContext] = useState(savedInterpretation?.context ?? "");
const [lastGenerated, setLastGenerated] = useState<GenerationInputs | null>(
  savedInterpretation
    ? { settings: savedInterpretation.settings, context: savedInterpretation.context ?? "" }
    : null
);
```

`generate` gains a tuning flag via two callers instead of a boolean parameter (per coding rules): `generateInitial()` (no body) and `regenerateTuned()` (sends `{ settings: tunedSettings, context: tunedContext.trim() || undefined }`). Both share a `runGenerate(tuning?: GenerationTuning, sentContext: string)` internal:

```typescript
const runGenerate = useCallback(
  async (tuning: GenerationTuning | undefined, sentContext: string) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setModalState("generating");
    setSaveError("");
    try {
      const result = await generateInterpretation(readingId, tuning);
      if (result.ok) {
        const trimmedContext = sentContext.trim();
        setUnsavedResult({
          ...result.data,
          ...(trimmedContext && { context: trimmedContext }),
        });
        setTunedSettings(result.data.settings);
        setLastGenerated({ settings: result.data.settings, context: trimmedContext });
        setModalState("preview");
      } else {
        setErrorMessage(result.error);
        setModalState("error");
      }
    } finally {
      isFetchingRef.current = false;
    }
  },
  [readingId]
);

const generateInitial = useCallback(() => runGenerate(undefined, ""), [runGenerate]);

const regenerateTuned = useCallback(
  () =>
    runGenerate(
      { settings: tunedSettings, context: tunedContext.trim() || undefined },
      tunedContext
    ),
  [runGenerate, tunedSettings, tunedContext]
);
```

Mount effect: only auto-generate when there is no saved baseline:

```typescript
useEffect(() => {
  if (!savedInterpretation && !hasFetchedRef.current) {
    hasFetchedRef.current = true;
    generateInitial();
  }
}, [savedInterpretation, generateInitial]);
```

Error-state "Try Again" retries what failed: keep a `retryRef` or simply call `regenerateTuned` when `lastGenerated`/tweak was the source and `generateInitial` otherwise — simplest correct rule: `onClick={lastGenerated ? regenerateTuned : generateInitial}` is WRONG (lastGenerated is set after success, and a tuned failure leaves the previous lastGenerated). Use a ref holding the last attempted call:

```typescript
const lastAttemptRef = useRef<() => void>(() => {});
// in generateInitial/regenerateTuned wrappers: lastAttemptRef.current = generateInitial / regenerateTuned before running
```

Concretely: set `lastAttemptRef.current` at the top of each wrapper, and the error button is `onClick={() => lastAttemptRef.current()}`.

Preview secondary button becomes:

```tsx
<button onClick={() => setModalState("tweak")} disabled={modalState === "saving"} ...>
  Tune &amp; Regenerate
</button>
```

Tweak state JSX (new block in the body, alongside the other states):

```tsx
{modalState === "tweak" && (
  <div className="flex flex-col gap-8">
    <InterpretationSettingsControls
      settings={tunedSettings}
      context={tunedContext}
      onSettingsChange={setTunedSettings}
      onContextChange={setTunedContext}
    />
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
      <button
        onClick={regenerateTuned}
        disabled={
          lastGenerated !== null &&
          !generationInputsChanged(
            { settings: tunedSettings, context: tunedContext },
            lastGenerated
          )
        }
        className="px-10 py-3 bg-gradient-to-br from-[#8a2be2]/80 to-[#5a1a9e]/80 text-[#e6d5b8] rounded-lg
                   font-bold shadow-lg hover:shadow-[#8a2be2]/40 transition-all text-sm border border-[#8a2be2]/40
                   disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
        style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.1em" }}
      >
        ✦ Regenerate ✦
      </button>
      {unsavedResult && (
        <button
          onClick={() => setModalState("preview")}
          className="px-8 py-3 border border-[#d4af37]/30 text-[#d4af37]/70 hover:text-[#d4af37]
                     hover:border-[#d4af37]/60 rounded-lg transition-all text-sm"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          Back to preview
        </button>
      )}
    </div>
    <p
      className="text-center text-xs text-[#e6d5b8]/40"
      style={{ fontFamily: "'Crimson Pro', serif" }}
    >
      Adjust the style, depth, tone, or context to regenerate.
    </p>
  </div>
)}
```

The close guard (`requestClose`) already keys on `unsavedResult` — tweak state with an unsaved result stays guarded for free. A tweak state with NO unsaved result (detail-page open, nothing generated) closes freely — correct, nothing to lose.

- [ ] **Step 2: Verify** — `npm run build && npm test`.

---

### Task 5: FE+BE verification checkpoint (no commit)

- [ ] `npm test && npm run build` — all green.
- [ ] Manual, with backend running:
  1. Fresh reading → save → interpret: generates with no body; response settings pre-fill the tweak controls (reflective/60/50 until Step 3).
  2. Preview → "Tune & Regenerate" → controls shown pre-filled; Regenerate disabled until any control or context changes.
  3. Set esoteric/20, add context "recently divorced" → Regenerate → new result; save → detail page shows it; reopen "✦ New Interpretation ✦" → opens directly in tweak, pre-filled esoteric/20/50 + saved context, Regenerate disabled until changed.
  4. Depth/tone extremes (0, 100) accepted; context counter stops at 100.
  5. Save without context after a context-ful save → stored context cleared (full replace, expected).
  6. Regenerate → discard on close → saved interpretation untouched.
