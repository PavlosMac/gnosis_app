# Decoupled Interpretation Flow — Step 1 Frontend Implementation Plan

> **Superseded (2026-08-21):** see `docs/multi-lens-interpretations.md` — lens/intent/depth settings, one interpretation slot per lens, backup/restore dropped.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Step 1 of `docs/superpowers/specs/2026-07-08-decoupled-interpretation-flow-design.md` — save-reading ribbon, generate/preview/save interpretation modal, detail-page null branch, overwrite backup + restore. No tuning controls (Step 2) and no profile defaults or list badge (Step 3).

**Architecture:** Three server actions (`createReading`, `generateInterpretation`, `saveInterpretation`) replace the chained `getInterpretation`. `TarotGame` saves the reading via a ribbon before the modal can open; the modal generates on open, previews, and saves explicitly. The detail page splits into an interpretation branch and a null branch, hosted by a new client child. A localStorage helper provides one-level backup/restore of overwritten interpretations.

**Tech Stack:** Next.js 16.1 (server actions), React 19, TypeScript strict, Zod 4, Tailwind 4, vitest (new dev dep, pure-logic tests only).

## Global Constraints

- All FastAPI calls go through `authenticatedFetch` (`src/lib/api-client.ts`); it returns `{ ok: true, data } | { ok: false, status, message? }`.
- Server actions validate with Zod before any API call and check `getCurrentUser()`.
- Keep the `.max(11)` card cap in `src/lib/validation/interpret-schemas.ts`.
- `settings` is always the full object `{ style, depth, tone }`: `style ∈ practical|reflective|spiritual|esoteric`, `depth`/`tone` int 0–100. Step 1 never sends settings on generate; it echoes the response's `settings` verbatim in the save body.
- `context` max length is 100 (unused in Step 1 UI, but the save schema allows it because generate may echo it later).
- `has_interpretation` does NOT exist on list responses yet (Step 3) — do not reference it.
- Dark mystical theme: gold `#d4af37`, fonts Cinzel (headers) / Crimson Pro (body); all new UI responsive (`sm:` breakpoints).
- Match existing code style: `"use client"` components, fat arrows, functional components, no comments explaining changes.
- Backend for manual testing: gnosis API at `localhost:8001` (`GNOSIS_API_BASE_URL`), app via `npm run dev`.
- Branch: work happens on the existing `update-interpreter` branch.

---

### Task 1: Vitest setup + `buildReadingPayload` helper

**Files:**
- Modify: `package.json` (add vitest dev dep + `test` script)
- Create: `vitest.config.ts`
- Create: `src/lib/reading-payload.ts`
- Test: `src/lib/__tests__/reading-payload.test.ts`

**Interfaces:**
- Consumes: `ReadingResult` from `src/types/reading.ts`, `InterpretRequest` from `src/types/interpret.ts` (Task 3 adds `birth_date?` to `InterpretRequest`; until then the helper types the field via the object literal, which compiles because Task 1 returns the payload as `InterpretRequest` — see Step 4 note).
- Produces: `buildReadingPayload(reading: ReadingResult): InterpretRequest` — used by `TarotGame` (Task 4).

- [ ] **Step 1: Install vitest and add config**

```bash
npm install -D vitest
```

Add to `package.json` scripts:

```json
"test": "vitest run"
```

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/__tests__/reading-payload.test.ts`. The card mapping logic being ported lives today in `src/components/InterpretationModal.tsx:72-90` — the tests pin its behavior:

```typescript
import { describe, it, expect } from "vitest";
import { buildReadingPayload } from "@/lib/reading-payload";
import type { ReadingResult, SelectedCard } from "@/types/reading";

const card = (name: string, reversed = false): SelectedCard =>
  ({ name, reversed, idx: 0 } as SelectedCard);

const baseReading: ReadingResult = {
  readingType: "Three Card Spread",
  positions: {
    Past: card("The Fool"),
    Present: card("The Magician", true),
  },
};

describe("buildReadingPayload", () => {
  it("maps positions to cards with orientation", () => {
    const payload = buildReadingPayload(baseReading);
    expect(payload.spread_name).toBe("Three Card Spread");
    expect(payload.cards).toEqual([
      { name: "The Fool", position: "Past", orientation: "upright" },
      { name: "The Magician", position: "Present", orientation: "reversed" },
    ]);
  });

  it("includes position_description when provided", () => {
    const payload = buildReadingPayload({
      ...baseReading,
      positionDescriptions: { Past: "What came before" },
    });
    expect(payload.cards[0].position_description).toBe("What came before");
    expect(payload.cards[1]).not.toHaveProperty("position_description");
  });

  it("includes question only when trimmed length is at least 5", () => {
    expect(
      buildReadingPayload({ ...baseReading, question: "Will I find love?" }).question
    ).toBe("Will I find love?");
    expect(
      buildReadingPayload({ ...baseReading, question: "  hi  " })
    ).not.toHaveProperty("question");
    expect(buildReadingPayload(baseReading)).not.toHaveProperty("question");
  });

  it("includes birth_date when present", () => {
    expect(
      buildReadingPayload({ ...baseReading, birth_date: "1990-03-12" }).birth_date
    ).toBe("1990-03-12");
    expect(buildReadingPayload(baseReading)).not.toHaveProperty("birth_date");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/reading-payload`.

- [ ] **Step 4: Implement the helper**

Create `src/lib/reading-payload.ts` (logic ported verbatim from `InterpretationModal.tsx:72-90`):

```typescript
import type { ReadingResult } from "@/types/reading";
import type { InterpretRequest } from "@/types/interpret";

const MIN_QUESTION_LENGTH = 5;

export const buildReadingPayload = (reading: ReadingResult): InterpretRequest => {
  const cards = Object.entries(reading.positions).map(([position, card]) => ({
    name: card.name,
    position,
    orientation: card.reversed ? ("reversed" as const) : ("upright" as const),
    ...(reading.positionDescriptions?.[position] && {
      position_description: reading.positionDescriptions[position],
    }),
  }));

  return {
    spread_name: reading.readingType,
    ...(reading.question && reading.question.trim().length >= MIN_QUESTION_LENGTH && {
      question: reading.question,
    }),
    ...(reading.birth_date && { birth_date: reading.birth_date }),
    cards,
  };
};
```

Note: `InterpretRequest` does not yet declare `birth_date` (Task 3 adds it). If `tsc` rejects the excess property here, add `birth_date?: string;` to `InterpretRequest` in `src/types/interpret.ts:10-14` as part of this task instead of Task 3 — it is a one-line, spec-mandated addition either way.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (4 tests).

- [ ] **Step 6: Verify build stays green and commit**

```bash
npm run build
git add package.json package-lock.json vitest.config.ts src/lib/reading-payload.ts src/lib/__tests__/reading-payload.test.ts
git commit -m "feat: add buildReadingPayload helper with vitest setup"
```

---

### Task 2: Interpretation backup helper (localStorage)

**Files:**
- Create: `src/lib/interpretation-backup.ts`
- Test: `src/lib/__tests__/interpretation-backup.test.ts`

**Interfaces:**
- Consumes: `Interpretation` type — Task 3 defines it. If executing this task before Task 3, define the type first (Task 3 Step 1 shows the exact code; it is additive and safe to bring forward).
- Produces:
  - `writeInterpretationBackup(readingId: string, interpretation: Interpretation): void`
  - `readInterpretationBackup(readingId: string): Interpretation | null`
  - Storage key format: `interpretation-backup:<readingId>` (spec flow 6).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/interpretation-backup.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  writeInterpretationBackup,
  readInterpretationBackup,
} from "@/lib/interpretation-backup";
import type { Interpretation } from "@/types/interpret";

const interpretation: Interpretation = {
  card_interpretations: [],
  synthesis: "The path is clear.",
  model: "gpt-test",
  tokens_used: 100,
  settings: { style: "reflective", depth: 60, tone: 50 },
};

const fakeStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
};

describe("interpretation backup", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is a no-op / null when window is undefined", () => {
    expect(() => writeInterpretationBackup("abc", interpretation)).not.toThrow();
    expect(readInterpretationBackup("abc")).toBeNull();
  });

  it("round-trips through localStorage keyed by reading id", () => {
    const storage = fakeStorage();
    vi.stubGlobal("window", { localStorage: storage });
    writeInterpretationBackup("abc123", interpretation);
    expect(storage.getItem("interpretation-backup:abc123")).not.toBeNull();
    expect(readInterpretationBackup("abc123")).toEqual(interpretation);
    expect(readInterpretationBackup("other")).toBeNull();
  });

  it("returns null on malformed stored JSON", () => {
    const storage = fakeStorage();
    storage.setItem("interpretation-backup:abc123", "{not json");
    vi.stubGlobal("window", { localStorage: storage });
    expect(readInterpretationBackup("abc123")).toBeNull();
  });

  it("swallows storage write failures (backup is best-effort)", () => {
    vi.stubGlobal("window", {
      localStorage: {
        setItem: () => {
          throw new DOMException("quota", "QuotaExceededError");
        },
        getItem: () => null,
      },
    });
    expect(() => writeInterpretationBackup("abc123", interpretation)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/interpretation-backup` (and `Interpretation` if Task 3 hasn't run — bring the type forward per the Interfaces note).

- [ ] **Step 3: Implement the helper**

Create `src/lib/interpretation-backup.ts`. Silent catch is a spec decision ("localStorage unavailable → backup silently skipped; save still works" — best-effort undo):

```typescript
import type { Interpretation } from "@/types/interpret";

const backupKey = (readingId: string) => `interpretation-backup:${readingId}`;

export const writeInterpretationBackup = (
  readingId: string,
  interpretation: Interpretation
): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(backupKey(readingId), JSON.stringify(interpretation));
  } catch {
    // best-effort per spec: storage full/blocked means no backup, never a failed save
  }
};

export const readInterpretationBackup = (
  readingId: string
): Interpretation | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(backupKey(readingId));
    return raw ? (JSON.parse(raw) as Interpretation) : null;
  } catch {
    return null;
  }
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all tests, both files).

- [ ] **Step 5: Commit**

```bash
git add src/lib/interpretation-backup.ts src/lib/__tests__/interpretation-backup.test.ts src/types/interpret.ts
git commit -m "feat: add localStorage backup helper for overwritten interpretations"
```

---

### Task 3: New types, Zod schemas, and server actions

**Files:**
- Modify: `src/types/interpret.ts`
- Modify: `src/lib/validation/interpret-schemas.ts`
- Modify: `src/app/user/interpret/actions.ts`

**Interfaces:**
- Consumes: `authenticatedFetch<T>` (`src/lib/api-client.ts:113`), `getCurrentUser` (`src/lib/session.ts`), `interpretRequestSchema`.
- Produces (used by Tasks 4–5):
  - Types: `InterpretationStyle`, `InterpretationSettings`, `Interpretation`, `CreateReadingResult`, `GenerateInterpretationResult`, `SaveInterpretationResult`.
  - Actions: `createReading(payload: InterpretRequest): Promise<CreateReadingResult>`, `generateInterpretation(readingId: string): Promise<GenerateInterpretationResult>`, `saveInterpretation(readingId: string, interpretation: Interpretation): Promise<SaveInterpretationResult>`.
  - `getInterpretation` stays in place until Task 4 (the old modal still calls it) — build stays green.

- [ ] **Step 1: Add the new types**

In `src/types/interpret.ts`, add `birth_date?: string;` to `InterpretRequest` (after `question?`, line 12 — skip if already added in Task 1), and append:

```typescript
export type InterpretationStyle =
  | "practical"
  | "reflective"
  | "spiritual"
  | "esoteric";

export interface InterpretationSettings {
  style: InterpretationStyle;
  depth: number;
  tone: number;
}

export interface Interpretation {
  card_interpretations: CardInterpretation[];
  synthesis: string;
  model: string;
  tokens_used: number;
  settings: InterpretationSettings;
  context?: string;
}

export type CreateReadingResult =
  | { ok: true; readingId: string }
  | { ok: false; error: string };

export type GenerateInterpretationResult =
  | { ok: true; data: Interpretation }
  | { ok: false; error: string };

export type SaveInterpretationResult =
  | { ok: true }
  | { ok: false; error: string };
```

Leave `InterpretResponse` / `InterpretResult` in place for now — the old modal still imports them; Task 4 deletes them.

- [ ] **Step 2: Add the Zod schemas**

Append to `src/lib/validation/interpret-schemas.ts`:

```typescript
export const CONTEXT_MAX_LENGTH = 100;

export const interpretationSettingsSchema = z.object({
  style: z.enum(["practical", "reflective", "spiritual", "esoteric"]),
  depth: z.number().int().min(0).max(100),
  tone: z.number().int().min(0).max(100),
});

export const saveInterpretationSchema = z.object({
  card_interpretations: z.array(
    z.object({
      card_name: z.string(),
      position: z.string(),
      orientation: z.enum(["upright", "reversed"]),
      interpretation: z.string(),
    })
  ),
  synthesis: z.string(),
  model: z.string(),
  tokens_used: z.number().int().min(0),
  settings: interpretationSettingsSchema,
  context: z.string().trim().max(CONTEXT_MAX_LENGTH).optional(),
});
```

- [ ] **Step 3: Add the three server actions**

In `src/app/user/interpret/actions.ts`, keep `getInterpretation` untouched and append (imports merge with the existing ones at the top):

```typescript
import { saveInterpretationSchema } from "@/lib/validation/interpret-schemas";
import type {
  Interpretation,
  CreateReadingResult,
  GenerateInterpretationResult,
  SaveInterpretationResult,
} from "@/types/interpret";

const NOT_LOGGED_IN = "You must be logged in to request an interpretation.";

export const createReading = async (
  payload: InterpretRequest
): Promise<CreateReadingResult> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: NOT_LOGGED_IN };

  const parsed = interpretRequestSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join(".") ?? "";
    const detail = path ? `${path}: ${issue?.message}` : (issue?.message ?? "Invalid request.");
    return { ok: false, error: detail };
  }

  const result = await authenticatedFetch<{ _id: string }>(`/api/v1/readings`, {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });

  if (!result.ok)
    return { ok: false, error: result.message ?? "The reading could not be saved." };

  return { ok: true, readingId: result.data._id };
};

export const generateInterpretation = async (
  readingId: string
): Promise<GenerateInterpretationResult> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: NOT_LOGGED_IN };

  const result = await authenticatedFetch<Interpretation>(
    `/api/v1/readings/${readingId}/interpretation/generate`,
    { method: "POST", body: JSON.stringify({}) }
  );

  if (!result.ok)
    return { ok: false, error: result.message ?? "The oracle could not be reached." };

  return { ok: true, data: result.data };
};

export const saveInterpretation = async (
  readingId: string,
  interpretation: Interpretation
): Promise<SaveInterpretationResult> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: NOT_LOGGED_IN };

  const parsed = saveInterpretationSchema.safeParse(interpretation);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid interpretation." };

  const result = await authenticatedFetch<Interpretation>(
    `/api/v1/readings/${readingId}/interpretation`,
    { method: "POST", body: JSON.stringify(parsed.data) }
  );

  if (!result.ok)
    return { ok: false, error: result.message ?? "The interpretation could not be saved." };

  return { ok: true };
};
```

Note the save body: it echoes the generate response verbatim — content + full `settings` object (+ `context` when present) — per the spec's "request/response shapes never change between steps" rule.

- [ ] **Step 4: Verify build and tests stay green**

Run: `npm run build && npm test`
Expected: build PASS, tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/interpret.ts src/lib/validation/interpret-schemas.ts src/app/user/interpret/actions.ts
git commit -m "feat: add createReading/generateInterpretation/saveInterpretation actions"
```

---

### Task 4: InterpretationModal rewrite + TarotGame ribbon and gating

These two change together — the modal's props contract and its host are inseparable.

**Files:**
- Rewrite: `src/components/InterpretationModal.tsx`
- Modify: `src/components/TarotGame.tsx`
- Modify: `src/app/user/interpret/actions.ts` (delete `getInterpretation`, now orphaned)
- Modify: `src/types/interpret.ts` (delete `InterpretResponse`, `InterpretResult`, now orphaned)

**Interfaces:**
- Consumes: Task 3 actions/types, Task 1 `buildReadingPayload`, Task 2 `writeInterpretationBackup`.
- Produces the modal contract Task 5's detail page also uses:

```typescript
interface InterpretationModalProps {
  readingId: string;
  spreadName: string;
  question?: string;
  birthDate?: string;
  cardVisuals: Record<string, { card: TarotCardData; reversed: boolean } | null>;
  savedInterpretation?: Interpretation | null;
  onClose: () => void;
  onSaved: () => void;
}
```

- [ ] **Step 1: Rewrite the modal**

Replace `src/components/InterpretationModal.tsx` entirely. Behavior: generates on mount (empty body — backend resolves defaults and echoes `settings`); preview shows the result with "✦ Save Interpretation ✦" (primary) and "Regenerate" (secondary, plain reroll — Step 1 has no tuning, the `lastGenerated` guard starts in Step 2); nothing persists until Save; all three close paths (× button, Escape, backdrop) route through an unsaved-result guard; on a save that replaces `savedInterpretation`, the old one is captured before the call and written to localStorage only after success.

```typescript
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import OrnateFrame from "@/components/OrnateFrame";
import InterpretationDisplay from "@/components/InterpretationDisplay";
import {
  generateInterpretation,
  saveInterpretation,
} from "@/app/user/interpret/actions";
import { writeInterpretationBackup } from "@/lib/interpretation-backup";
import type { TarotCardData } from "@/types/models";
import type { Interpretation } from "@/types/interpret";

type ModalState = "generating" | "preview" | "saving" | "error";

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Format a "YYYY-MM-DD" birthdate as "12 Mar 1990" (matches readings list style)
const formatBirthDate = (iso: string): string => {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${SHORT_MONTHS[month - 1]} ${year}`;
};

interface InterpretationModalProps {
  readingId: string;
  spreadName: string;
  question?: string;
  birthDate?: string;
  cardVisuals: Record<string, { card: TarotCardData; reversed: boolean } | null>;
  savedInterpretation?: Interpretation | null;
  onClose: () => void;
  onSaved: () => void;
}

const InterpretationModal: React.FC<InterpretationModalProps> = React.memo(({
  readingId,
  spreadName,
  question,
  birthDate,
  cardVisuals,
  savedInterpretation,
  onClose,
  onSaved,
}) => {
  const [modalState, setModalState] = useState<ModalState>("generating");
  const [unsavedResult, setUnsavedResult] = useState<Interpretation | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const isFetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);

  const requestClose = useCallback(() => {
    if (unsavedResult) {
      setShowCloseConfirm(true);
      return;
    }
    onClose();
  }, [unsavedResult, onClose]);

  // Lock body scroll and handle Escape key
  useEffect(() => {
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [requestClose]);

  const generate = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setModalState("generating");
    setSaveError("");
    try {
      const result = await generateInterpretation(readingId);
      if (result.ok) {
        setUnsavedResult(result.data);
        setModalState("preview");
      } else {
        setErrorMessage(result.error);
        setModalState("error");
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [readingId]);

  // Fire once on mount
  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      generate();
    }
  }, [generate]);

  const handleSave = useCallback(async () => {
    if (!unsavedResult) return;
    setModalState("saving");
    setSaveError("");
    const replaced = savedInterpretation ?? null;
    const result = await saveInterpretation(readingId, unsavedResult);
    if (!result.ok) {
      setSaveError(result.error);
      setModalState("preview");
      return;
    }
    if (replaced) writeInterpretationBackup(readingId, replaced);
    setUnsavedResult(null);
    onSaved();
    onClose();
  }, [unsavedResult, savedInterpretation, readingId, onSaved, onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center isolate"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm z-0"
        onClick={requestClose}
      />

      {/* Modal panel */}
      <div
        className="relative z-10 w-full mx-4 my-8 max-w-3xl max-h-[calc(100vh-4rem)] overflow-y-auto rounded-xl border-2 border-[#d4af37]/40 shadow-2xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(26,0,51,0.97) 0%, rgba(45,27,78,0.97) 100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ornate corner decorations */}
        <OrnateFrame size="sm" corners="top" />

        {/* Sticky header */}
        <div
          className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-[#d4af37]/20"
          style={{
            background:
              "linear-gradient(135deg, rgba(26,0,51,0.98) 0%, rgba(45,27,78,0.98) 100%)",
          }}
        >
          <div className="flex flex-col gap-1 min-w-0">
            <h2
              className="text-xl sm:text-2xl font-bold text-[#d4af37] tracking-wider"
              style={{
                fontFamily: "'Cinzel', serif",
                textShadow: "0 0 15px rgba(212,175,55,0.4)",
              }}
            >
              ✦ Interpretation ✦
            </h2>
            <p
              className="text-xs sm:text-sm text-[#d4af37]/70 tracking-wide truncate"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              {spreadName}
              {birthDate && ` · ${formatBirthDate(birthDate)}`}
            </p>
          </div>
          <button
            onClick={requestClose}
            className="shrink-0 text-[#d4af37]/60 hover:text-[#d4af37] transition-colors text-2xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* GENERATING STATE */}
          {modalState === "generating" && (
            <div className="flex flex-col items-center gap-6 py-16">
              <div className="w-16 h-16 border-4 border-[#d4af37]/20 border-t-[#d4af37] rounded-full animate-spin" />
              <p
                className="text-[#d4af37]/80 text-lg tracking-wider"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                The Oracle consults the stars...
              </p>
            </div>
          )}

          {/* ERROR STATE (generate failed) */}
          {modalState === "error" && (
            <div className="flex flex-col items-center gap-6 py-8">
              <p
                className="text-red-400 text-center text-base"
                style={{ fontFamily: "'Crimson Pro', serif" }}
              >
                {errorMessage || "The oracle could not be reached."}
              </p>
              <button
                onClick={generate}
                className="px-8 py-3 border border-[#d4af37]/40 text-[#d4af37] hover:bg-[#d4af37]/10 rounded-lg transition-all text-sm"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* PREVIEW / SAVING STATE */}
          {(modalState === "preview" || modalState === "saving") && unsavedResult && (
            <div className="flex flex-col gap-8">
              <InterpretationDisplay
                question={question}
                cardInterpretations={unsavedResult.card_interpretations}
                synthesis={unsavedResult.synthesis}
                cardVisuals={cardVisuals}
              />

              {saveError && (
                <p
                  className="text-red-400 text-center text-sm"
                  style={{ fontFamily: "'Crimson Pro', serif" }}
                >
                  {saveError}
                </p>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={handleSave}
                  disabled={modalState === "saving"}
                  className="px-10 py-3 bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] rounded-lg
                             font-bold shadow-lg hover:shadow-[#d4af37]/50 transition-all
                             disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                  style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.1em" }}
                >
                  {modalState === "saving" ? "Saving..." : "✦ Save Interpretation ✦"}
                </button>
                <button
                  onClick={generate}
                  disabled={modalState === "saving"}
                  className="px-8 py-3 border border-[#d4af37]/30 text-[#d4af37]/70 hover:text-[#d4af37]
                             hover:border-[#d4af37]/60 rounded-lg transition-all text-sm
                             disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  Regenerate
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Unsaved-close confirmation */}
        {showCloseConfirm && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70">
            <div
              className="mx-6 p-6 rounded-xl border-2 border-[#d4af37]/40 text-center"
              style={{
                background:
                  "linear-gradient(135deg, rgba(26,0,51,0.98) 0%, rgba(45,27,78,0.98) 100%)",
              }}
            >
              <p
                className="text-[#e6d5b8]/90 mb-6"
                style={{ fontFamily: "'Crimson Pro', serif" }}
              >
                Save this interpretation before leaving?
              </p>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => {
                    setShowCloseConfirm(false);
                    handleSave();
                  }}
                  className="px-8 py-2.5 bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033]
                             rounded-lg font-bold text-sm"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  Save
                </button>
                <button
                  onClick={onClose}
                  className="px-8 py-2.5 border border-[#d4af37]/30 text-[#d4af37]/70
                             hover:text-[#d4af37] rounded-lg text-sm"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
});

InterpretationModal.displayName = "InterpretationModal";

export default InterpretationModal;
```

- [ ] **Step 2: Update TarotGame — state and handlers**

In `src/components/TarotGame.tsx`:

Replace imports (line 16): drop `import type { InterpretResult } from "@/types/interpret";`, add:

```typescript
import { createReading } from "@/app/user/interpret/actions";
import { buildReadingPayload } from "@/lib/reading-payload";
import type { TarotCardData } from "@/types/models";
```

Replace the `interpretResult` state (line 58) with:

```typescript
const [savedReadingId, setSavedReadingId] = useState<string | null>(null);
const [savingReading, setSavingReading] = useState(false);
const [saveReadingError, setSaveReadingError] = useState<string | null>(null);
```

Replace `handleResultReceived` (lines 126-128) with:

```typescript
const saveReading = useCallback(async () => {
  if (!completedReading || savingReading || savedReadingId) return;
  setSavingReading(true);
  setSaveReadingError(null);
  const result = await createReading(buildReadingPayload(completedReading));
  if (result.ok) {
    setSavedReadingId(result.readingId);
  } else {
    setSaveReadingError(result.error);
  }
  setSavingReading(false);
}, [completedReading, savingReading, savedReadingId]);

const handleRibbonClick = useCallback(() => {
  if (!isLoggedIn) {
    setShowLoginModal(true);
    return;
  }
  saveReading();
}, [isLoggedIn, saveReading]);

const cardVisuals = useMemo(
  () =>
    completedReading
      ? Object.fromEntries(
          Object.entries(completedReading.positions).map(([pos, card]) => [
            pos,
            { card: card as TarotCardData, reversed: card.reversed },
          ])
        )
      : {},
  [completedReading]
);
```

Update `handleNewReading` (lines 108-113) to reset the new state:

```typescript
const handleNewReading = useCallback(() => {
  dispatch({ type: 'RESET' });
  setShowInterpretModal(false);
  setShowLoginModal(false);
  setSavedReadingId(null);
  setSaveReadingError(null);
}, []);
```

Update `handleLoginSuccess` (lines 119-124) — after login, the reading saves (spec flow 9):

```typescript
const handleLoginSuccess = useCallback(() => {
  setShowLoginModal(false);
  setIsLoggedIn(true);
  router.refresh();
  saveReading();
}, [router, saveReading]);
```

- [ ] **Step 3: Update TarotGame — ribbon and button JSX**

Wrap the reading block (lines 428-438) so the ribbon pins to the spread's top-right:

```tsx
{game.phase === 'reading' && (
  <div ref={readingRef} className="relative mt-10 flex justify-center animate-fadeIn">
    <Reading
      selectedCards={selectedCards}
      positions={positionNames}
      question={selectedReading.showQuestion ? userQuestion : undefined}
      isComplete={isReadingComplete}
      significatorResult={completedReading?.significatorResult}
    />

    {isReadingComplete && (
      <div className="absolute top-0 right-1 sm:right-4 flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={handleRibbonClick}
          disabled={savingReading || !!savedReadingId}
          aria-label={savedReadingId ? "Saved to Journal" : "Save this reading"}
          className={`p-2 rounded-lg border transition-all duration-300
            ${savedReadingId
              ? 'border-[#d4af37] bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033]'
              : 'border-[#d4af37]/40 text-[#d4af37]/70 hover:text-[#d4af37] hover:border-[#d4af37] bg-[#1a0033]/70'}
            disabled:cursor-default`}
        >
          <svg width="18" height="22" viewBox="0 0 18 22" aria-hidden="true">
            <path
              d="M2 1h14v20l-7-5-7 5V1z"
              fill={savedReadingId ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </button>
        <span
          className="text-[10px] sm:text-xs text-[#d4af37]/60 text-right max-w-[9rem]"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          {savedReadingId
            ? "Saved to Journal"
            : savingReading
              ? "Saving..."
              : "Save this reading to get an interpretation"}
        </span>
        {saveReadingError && (
          <span
            className="text-[10px] sm:text-xs text-red-400 text-right max-w-[9rem]"
            style={{ fontFamily: "'Crimson Pro', serif" }}
          >
            {saveReadingError}
          </span>
        )}
      </div>
    )}
  </div>
)}
```

Replace the interpret/login button (lines 452-460) — the login button is removed; the interpret button appears only after the save (spec flows 2 and 9):

```tsx
{savedReadingId && (
  <button
    className="px-8 sm:px-10 py-3 sm:py-4 bg-gradient-to-br from-[#8a2be2]/80 to-[#5a1a9e]/80 text-[#e6d5b8] rounded-lg
               shadow-lg hover:shadow-[#8a2be2]/40 transition-all duration-300 font-bold text-base sm:text-lg
               hover:scale-105 active:scale-95 border border-[#8a2be2]/40 animate-fadeIn"
    style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.1em' }}
    onClick={() => setShowInterpretModal(true)}
  >
    ✦ Oracle Interpretation ✦
  </button>
)}
```

Replace the modal render (lines 518-525) with the new contract:

```tsx
{showInterpretModal && completedReading && savedReadingId && (
  <InterpretationModal
    readingId={savedReadingId}
    spreadName={completedReading.readingType}
    question={completedReading.question}
    birthDate={completedReading.birth_date}
    cardVisuals={cardVisuals}
    onClose={handleCloseModal}
    onSaved={() => {}}
  />
)}
```

- [ ] **Step 4: Delete orphaned code**

- `src/app/user/interpret/actions.ts`: delete `getInterpretation` (lines 9-50 of the pre-Task-3 file) and the now-unused imports it leaves behind (`InterpretResponse`, `InterpretResult`, `ReadingDetail`).
- `src/types/interpret.ts`: delete `InterpretResponse` and `InterpretResult`.
- Verify nothing else references them: `grep -rn "InterpretResponse\|InterpretResult\|getInterpretation" src` → expect no matches.

- [ ] **Step 5: Verify build and tests**

Run: `npm run build && npm test && npm run lint`
Expected: all PASS. (`src/app/user/readings/[id]/page.tsx` still compiles — `ReadingDetail` is untouched until Task 5.)

- [ ] **Step 6: Commit**

```bash
git add src/components/InterpretationModal.tsx src/components/TarotGame.tsx src/app/user/interpret/actions.ts src/types/interpret.ts
git commit -m "feat: ribbon save gates interpretation; modal previews and saves explicitly"
```

---

### Task 5: Nested `ReadingDetail.interpretation` + detail page branches + restore

**Files:**
- Modify: `src/types/reading.ts:37-42`
- Modify: `src/app/user/readings/[id]/page.tsx`
- Create: `src/app/user/readings/[id]/InterpretationSection.tsx`

**Interfaces:**
- Consumes: modal contract from Task 4, `saveInterpretation` from Task 3, backup helpers from Task 2, `Interpretation` from Task 3.
- Produces: `InterpretationSection` client component with props `{ readingId: string; spreadName: string; question: string | null; birthDate?: string; cardVisuals: Record<string, { card: TarotCardData; reversed: boolean } | null>; cards: SavedCard[]; interpretation: Interpretation | null }`.

- [ ] **Step 1: Change the type**

In `src/types/reading.ts`, replace `ReadingDetail` (lines 37-42):

```typescript
export interface ReadingDetail extends ReadingListItem {
  interpretation: Interpretation | null;
}
```

Update the imports at the top: `import type { CardOrientation } from "@/types/interpret";` becomes

```typescript
import type { CardOrientation, Interpretation } from "@/types/interpret";
```

(`CardInterpretation` is no longer used here — remove it from the import.)

Note: `UpdateTagsResult` still wraps `ReadingDetail`. Whether the tags PATCH response embeds `interpretation` is an open backend question (spec "Open questions" #1) — `ReadingTags` only consumes `tags`, so do not read `interpretation` from tags responses anywhere.

- [ ] **Step 2: Create the client section component**

Create `src/app/user/readings/[id]/InterpretationSection.tsx`. It renders either the saved interpretation (with the tokens/model footer inside this branch — fixing the null crash at the old `page.tsx:124`) plus a "✦ New Interpretation ✦" button, or a card-only layout with "✦ Oracle Interpretation ✦". It also owns the restore link (spec flow 6: restore re-posts the backup, then backs up the replaced one, so restore is reversible).

```typescript
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import InterpretationDisplay from "@/components/InterpretationDisplay";
import InterpretationModal from "@/components/InterpretationModal";
import TarotCard from "@/components/TarotCard";
import { saveInterpretation } from "@/app/user/interpret/actions";
import {
  readInterpretationBackup,
  writeInterpretationBackup,
} from "@/lib/interpretation-backup";
import type { TarotCardData } from "@/types/models";
import type { SavedCard } from "@/types/reading";
import type { Interpretation } from "@/types/interpret";

interface InterpretationSectionProps {
  readingId: string;
  spreadName: string;
  question: string | null;
  birthDate?: string;
  cardVisuals: Record<string, { card: TarotCardData; reversed: boolean } | null>;
  cards: SavedCard[];
  interpretation: Interpretation | null;
}

const InterpretationSection: React.FC<InterpretationSectionProps> = ({
  readingId,
  spreadName,
  question,
  birthDate,
  cardVisuals,
  cards,
  interpretation,
}) => {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [hasBackup, setHasBackup] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState("");

  // localStorage is client-only; read after mount to avoid hydration mismatch
  useEffect(() => {
    setHasBackup(readInterpretationBackup(readingId) !== null);
  }, [readingId, interpretation]);

  const handleRestore = useCallback(async () => {
    const backup = readInterpretationBackup(readingId);
    if (!backup) return;
    setRestoring(true);
    setRestoreError("");
    const result = await saveInterpretation(readingId, backup);
    if (result.ok) {
      if (interpretation) writeInterpretationBackup(readingId, interpretation);
      router.refresh();
    } else {
      setRestoreError(result.error);
    }
    setRestoring(false);
  }, [readingId, interpretation, router]);

  return (
    <>
      {interpretation ? (
        <>
          <div className="rounded-2xl border border-[#d4af37]/20 bg-gradient-to-b from-[#1a0033]/80 to-[#0a0015]/80 backdrop-blur-sm p-5 sm:p-8">
            <InterpretationDisplay
              question={question}
              cardInterpretations={interpretation.card_interpretations}
              synthesis={interpretation.synthesis}
              cardVisuals={cardVisuals}
            />
          </div>
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#e6d5b8]/30">
            <span style={{ fontFamily: "'Crimson Pro', serif" }}>
              Model: {interpretation.model} &middot;{" "}
              {interpretation.tokens_used.toLocaleString()} tokens
            </span>
            <button
              onClick={() => setShowModal(true)}
              className="text-[#d4af37]/60 hover:text-[#d4af37] transition-colors tracking-wider text-xs"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              ✦ New Interpretation ✦
            </button>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-[#d4af37]/20 bg-gradient-to-b from-[#1a0033]/80 to-[#0a0015]/80 backdrop-blur-sm p-5 sm:p-8">
          <div className="flex flex-wrap justify-center gap-6">
            {cards.map((saved) => {
              const visual = cardVisuals[saved.position];
              return (
                <div key={saved.position} className="flex flex-col items-center gap-2">
                  {visual && (
                    <TarotCard
                      card={{ ...visual.card, reversed: visual.reversed }}
                      small={true}
                      showMeaning={false}
                    />
                  )}
                  <span
                    className="text-xs text-[#e6d5b8]/60 text-center"
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    {saved.position}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => setShowModal(true)}
              className="px-8 sm:px-10 py-3 sm:py-4 bg-gradient-to-br from-[#8a2be2]/80 to-[#5a1a9e]/80 text-[#e6d5b8] rounded-lg
                         shadow-lg hover:shadow-[#8a2be2]/40 transition-all duration-300 font-bold text-base sm:text-lg
                         hover:scale-105 active:scale-95 border border-[#8a2be2]/40"
              style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.1em" }}
            >
              ✦ Oracle Interpretation ✦
            </button>
          </div>
        </div>
      )}

      {hasBackup && (
        <div className="mt-3 text-center">
          <button
            onClick={handleRestore}
            disabled={restoring}
            className="text-xs text-[#d4af37]/50 hover:text-[#d4af37] transition-colors tracking-wider
                       disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {restoring ? "Restoring..." : "Restore previous interpretation"}
          </button>
          {restoreError && (
            <p
              className="text-red-400 text-xs mt-1"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              {restoreError}
            </p>
          )}
        </div>
      )}

      {showModal && (
        <InterpretationModal
          readingId={readingId}
          spreadName={spreadName}
          question={question ?? undefined}
          birthDate={birthDate}
          cardVisuals={cardVisuals}
          savedInterpretation={interpretation}
          onClose={() => setShowModal(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </>
  );
};

export default InterpretationSection;
```

- [ ] **Step 3: Rewire the server page**

In `src/app/user/readings/[id]/page.tsx`:

- Remove the `InterpretationDisplay` import; add `import InterpretationSection from "./InterpretationSection";`.
- Replace the interpretation content block AND the footer meta block (lines 111-133) with:

```tsx
<InterpretationSection
  readingId={reading._id}
  spreadName={reading.spread_type}
  question={reading.question}
  birthDate={reading.birth_date}
  cardVisuals={cardVisuals}
  cards={reading.cards}
  interpretation={reading.interpretation}
/>

{/* Footer nav */}
<div className="mt-8 flex justify-center text-xs">
  <Link
    href="/user/readings"
    className="text-[#d4af37]/50 hover:text-[#d4af37] transition-colors tracking-wider"
    style={{ fontFamily: "'Cinzel', serif" }}
  >
    &#8592; All Readings
  </Link>
</div>
```

Everything above (header, tags, cardVisuals construction at lines 60-69) stays as is.

- [ ] **Step 4: Verify build and tests**

Run: `npm run build && npm test && npm run lint`
Expected: all PASS. Confirm nothing still references the removed flat fields: `grep -rn "\.card_interpretations\|\.synthesis\|\.tokens_used" src --include="*.tsx" --include="*.ts"` — remaining hits must all go through `interpretation.` or `unsavedResult.`/`result.` (modal), never `reading.` directly.

- [ ] **Step 5: Commit**

```bash
git add src/types/reading.ts src/app/user/readings/[id]/page.tsx src/app/user/readings/[id]/InterpretationSection.tsx
git commit -m "feat: detail page renders nested interpretation with null branch and restore"
```

---

### Task 6: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full automated check**

```bash
npm test && npm run lint && npm run build
```

Expected: all PASS.

- [ ] **Step 2: Manual flow check against the local backend**

Requires the gnosis API on `localhost:8001` and `npm run dev`. Walk the spec's flows:

1. Logged in, complete a spread → ribbon appears top-right with caption → click → ribbon turns solid gold, "Saved to Journal", interpret button fades in. Verify via the network tab / backend logs that `POST /readings` fired **without** an LLM call.
2. Click "✦ Oracle Interpretation ✦" → modal generates → preview shows Save + Regenerate. Regenerate re-calls generate. Nothing appears in the journal's interpretation until Save.
3. Save → modal closes. Open `/user/readings` → open the reading → interpretation renders with model/tokens footer inside the branch.
4. On the detail page click "✦ New Interpretation ✦" → generate → Save → "Restore previous interpretation" link appears (backup written). Click restore → previous interpretation returns; restore is reversible (link remains, now holding the replaced one).
5. Generate then press Escape / click backdrop / click × → "Save this interpretation before leaving?" appears each way; Discard closes without persisting.
6. Save a reading, close the tab without interpreting → journal shows the reading; its detail page shows the card-only branch + interpret button.
7. Logged out: complete a spread → ribbon click opens the login modal (no "Login to Get Interpretation" button anywhere) → after login the reading saves and the interpret button appears.

- [ ] **Step 3: Log the work**

Add an entry to `docs/project_notes/issues.md` (date 2026-07-09, Step 1 frontend of decoupled interpretation flow, status done) per the project memory protocol.

- [ ] **Step 4: Final commit (if verification produced fixes)**

```bash
git add -A && git commit -m "chore: step 1 verification fixes"
```

---

## Self-review notes

- **Spec coverage:** flows 1, 2, 3, 5, 6, 7, 9 → Tasks 4-5; flow 4 (tune) and 8 (profile defaults) are Step 2/3, out of scope; types → Tasks 3/5 (auth.ts untouched — Step 3); payload helper → Task 1; backup → Task 2; null-crash footer fix → Task 5; Step 1 plain Regenerate exemption from the `lastGenerated` guard → Task 4 Step 1.
- **Deliberately not done:** `has_interpretation` badge (Step 3), settings controls (Step 2), `auth.ts` changes (Step 3), any change to `updateReadingTags` (open backend question — consumer only reads `tags`).
- **Type consistency check:** modal props identical in Task 4 Step 1, Task 4 Step 3 (TarotGame call site), and Task 5 Step 2 (detail call site); `Interpretation` shape identical in Tasks 2, 3, 5.
