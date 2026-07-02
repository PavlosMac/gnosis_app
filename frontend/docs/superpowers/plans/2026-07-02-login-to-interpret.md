# Login to Get Interpretation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a completed reading is shown to a logged-out user, replace the "Oracle Interpretation" button with a "Login to Get Interpretation" button that opens an inline login modal; on successful login, the interpretation is fetched automatically with no page navigation and no loss of the reading.

**Architecture:** Split the existing `login` server action's core logic into a reusable helper so a new `loginInline` action can authenticate without redirecting. Add a new `LoginToInterpretModal` client component (styled like the existing `InterpretationModal`) that uses `loginInline`. Wire it into `TarotGame.tsx` alongside the existing interpretation flow, using `router.refresh()` after login to sync the server-fetched `user` prop without losing client state.

**Tech Stack:** Next.js 16 App Router, React `useActionState`, Zod validation (existing `loginSchema`), Tailwind CSS.

## Global Constraints

- No localStorage/sessionStorage is introduced — the reading stays in `useGameReducer` state (spec: "Why no temp storage is needed").
- The new login modal has no register link — login only.
- The existing `login` server action (used by `/user/login`) must behave identically after refactor: same validation, same error shape, same redirect to `/user/profile`.
- Reuse existing components: `AuthField`, `OrnateFrame`. Match existing button/modal styling (Cinzel/Crimson Pro fonts, `#d4af37` gold / `#8a2be2` purple palette) — no new visual language.
- This project has no automated test suite (`npm run lint` and manual browser verification via `npm run dev` are the only verification tools — confirmed via `package.json`, no jest/vitest/testing-library present).

---

### Task 1: Extract shared login logic, add non-redirecting `loginInline` action

**Files:**
- Modify: `src/app/user/login/actions.ts` (currently lines 1-42)

**Interfaces:**
- Produces: `loginInline(prevState: LoginFormState, formData: FormData): Promise<LoginFormState>` — same signature shape as the existing `login` action, for use with `useActionState`. Returns `{ success: true }` on success (never redirects), or `{ success: false, error? , fieldErrors? }` on failure.
- Consumes: existing `publicFetch`, `setAuthCookies` from `@/lib/api-client`; `loginSchema` from `@/lib/validation/auth-schemas`; `LoginFormState`, `TokenResponse` from `@/types/auth`.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/app/user/login/actions.ts` with:

```ts
"use server";

import { redirect } from "next/navigation";
import { publicFetch, setAuthCookies } from "@/lib/api-client";
import { loginSchema } from "@/lib/validation/auth-schemas";
import type { LoginFormState, TokenResponse } from "@/types/auth";

const authenticateWithCredentials = async (
  formData: FormData
): Promise<LoginFormState> => {
  console.log("[AUTH:LOGIN] Login attempt", { email: formData.get("email") });

  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    console.log("[AUTH:LOGIN] Validation failed", parsed.error.flatten().fieldErrors);
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await publicFetch<TokenResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });

  if (!result.ok) {
    console.log("[AUTH:LOGIN] Login failed", { error: result.message });
    return { success: false, error: result.message };
  }

  console.log("[AUTH:LOGIN] Login successful — setting cookies");
  await setAuthCookies(result.data);

  return { success: true };
};

export const login = async (
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> => {
  const result = await authenticateWithCredentials(formData);
  if (!result.success) return result;

  redirect("/user/profile");
};

export const loginInline = async (
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> => {
  return authenticateWithCredentials(formData);
};
```

- [ ] **Step 2: Type-check and lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Manually verify the existing `/login` page still works**

Run: `npm run dev`, visit `http://localhost:3000/user/login`, log in with a valid account.
Expected: redirected to `/user/profile` exactly as before. Try an invalid password too — expected: inline error shown, no redirect (unchanged behavior).

- [ ] **Step 4: Commit**

```bash
git add src/app/user/login/actions.ts
git commit -m "refactor: extract shared login logic, add non-redirecting loginInline action"
```

---

### Task 2: Create `LoginToInterpretModal` component

**Files:**
- Create: `src/components/LoginToInterpretModal.tsx`

**Interfaces:**
- Consumes: `loginInline` from `@/app/user/login/actions` (Task 1); `AuthField` from `@/components/AuthField` (props: `name, type, label, placeholder, error?, autoComplete?, required?`); `OrnateFrame` from `@/components/OrnateFrame` (props used elsewhere: `size="sm" corners="top"`); `LoginFormState` from `@/types/auth`.
- Produces: `LoginToInterpretModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void })` — default export. Calls `onSuccess()` once when login succeeds; calls `onClose()` on backdrop click, × button, or Escape key.

- [ ] **Step 1: Write the component**

Create `src/components/LoginToInterpretModal.tsx`:

```tsx
"use client";

import React, { useActionState, useEffect } from "react";
import { createPortal } from "react-dom";
import OrnateFrame from "@/components/OrnateFrame";
import AuthField from "@/components/AuthField";
import { loginInline } from "@/app/user/login/actions";
import type { LoginFormState } from "@/types/auth";

interface LoginToInterpretModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const initialState: LoginFormState = { success: false };

const LoginToInterpretModal: React.FC<LoginToInterpretModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const [state, formAction, pending] = useActionState(loginInline, initialState);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  useEffect(() => {
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center isolate"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm z-0"
        onClick={onClose}
      />

      <div
        className="relative z-10 w-full mx-4 my-8 max-w-md rounded-xl border-2 border-[#d4af37]/40 shadow-2xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(26,0,51,0.97) 0%, rgba(45,27,78,0.97) 100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <OrnateFrame size="sm" corners="top" />

        <div
          className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-[#d4af37]/20"
          style={{
            background:
              "linear-gradient(135deg, rgba(26,0,51,0.98) 0%, rgba(45,27,78,0.98) 100%)",
          }}
        >
          <h2
            className="text-xl sm:text-2xl font-bold text-[#d4af37] tracking-wider"
            style={{
              fontFamily: "'Cinzel', serif",
              textShadow: "0 0 15px rgba(212,175,55,0.4)",
            }}
          >
            ✦ Enter the Sanctum ✦
          </h2>
          <button
            onClick={onClose}
            className="shrink-0 text-[#d4af37]/60 hover:text-[#d4af37] transition-colors text-2xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          <p
            className="text-center text-[#e6d5b8]/60 text-sm mb-6"
            style={{ fontFamily: "'Crimson Pro', serif" }}
          >
            Login to reveal the Oracle&apos;s interpretation of your reading.
          </p>

          {state.error && (
            <p
              className="mb-6 text-center text-sm text-red-400/90 border border-red-400/20 rounded-lg px-4 py-3 bg-red-400/5"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              {state.error}
            </p>
          )}

          <form action={formAction} className="space-y-6">
            <AuthField
              name="email"
              type="email"
              label="Email"
              placeholder="your@email.com"
              error={state.fieldErrors?.email?.[0]}
              autoComplete="email"
              required
            />
            <AuthField
              name="password"
              type="password"
              label="Password"
              placeholder="••••••••"
              error={state.fieldErrors?.password?.[0]}
              autoComplete="current-password"
              required
            />

            <button
              type="submit"
              disabled={pending}
              className="w-full py-3 rounded-lg border border-[#d4af37]/60
                         bg-gradient-to-r from-[#d4af37]/20 via-[#d4af37]/15 to-[#d4af37]/20
                         text-[#d4af37] tracking-widest uppercase text-sm
                         hover:border-[#d4af37] hover:bg-[#d4af37]/30
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-300"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              {pending ? "Entering..." : "Enter"}
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LoginToInterpretModal;
```

- [ ] **Step 2: Type-check and lint**

Run: `npm run lint`
Expected: no errors. This component is not yet rendered anywhere, so there is no browser check for this task — visual/behavioral verification happens in Task 3 once it's wired in.

- [ ] **Step 3: Commit**

```bash
git add src/components/LoginToInterpretModal.tsx
git commit -m "feat: add LoginToInterpretModal component"
```

---

### Task 3: Wire the login-to-interpret flow into `TarotGame.tsx`

**Files:**
- Modify: `src/components/TarotGame.tsx:1-14` (imports), `:47-56` (state), `:109-113` (handlers), `:437-447` (button), `:505-512` (modal render)

**Interfaces:**
- Consumes: `LoginToInterpretModal` from Task 2 (`onClose`, `onSuccess` props); `useRouter` from `next/navigation`.

- [ ] **Step 1: Add imports**

In `src/components/TarotGame.tsx`, replace lines 1-14:

```tsx
"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Reading from "@/components/Reading";
import ShuffledDeck from "@/components/ShuffledDeck";
import ShuffleAnimation from "@/components/ShuffleAnimation";
import InterpretationModal from "@/components/InterpretationModal";
import OrnateFrame from "@/components/OrnateFrame";
import readingsConfig from "@/lib/readings-config.json";
import { parseAndValidateDate } from "@/lib/dateValidation";

import { useGameReducer, getSelectedCards, getReading } from "@/hooks/useGameReducer";
import type { User } from "@/types/auth";
import type { SelectedCard } from "@/types/reading";
import type { InterpretResult } from "@/types/interpret";
```

with:

```tsx
"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Reading from "@/components/Reading";
import ShuffledDeck from "@/components/ShuffledDeck";
import ShuffleAnimation from "@/components/ShuffleAnimation";
import InterpretationModal from "@/components/InterpretationModal";
import LoginToInterpretModal from "@/components/LoginToInterpretModal";
import OrnateFrame from "@/components/OrnateFrame";
import readingsConfig from "@/lib/readings-config.json";
import { parseAndValidateDate } from "@/lib/dateValidation";

import { useGameReducer, getSelectedCards, getReading } from "@/hooks/useGameReducer";
import type { User } from "@/types/auth";
import type { SelectedCard } from "@/types/reading";
import type { InterpretResult } from "@/types/interpret";
```

- [ ] **Step 2: Add `router` and `showLoginModal` state**

Replace lines 47-56:

```tsx
export default function TarotGame({ user }: TarotGameProps) {
  const [selectedReading, setSelectedReading] = useState<ReadingConfig>(readings[1]);
  const [allowReversals, setAllowReversals] = useState(false);
  const [userQuestion, setUserQuestion] = useState<string>("");
  const [showOracleInfo, setShowOracleInfo] = useState(false);
  const [showInterpretModal, setShowInterpretModal] = useState(false);
  const [interpretResult, setInterpretResult] = useState<InterpretResult | null>(null);
  const [game, dispatch] = useGameReducer();
  const deckRef = useRef<HTMLDivElement>(null);
  const readingRef = useRef<HTMLDivElement>(null);
```

with:

```tsx
export default function TarotGame({ user }: TarotGameProps) {
  const router = useRouter();
  const [selectedReading, setSelectedReading] = useState<ReadingConfig>(readings[1]);
  const [allowReversals, setAllowReversals] = useState(false);
  const [userQuestion, setUserQuestion] = useState<string>("");
  const [showOracleInfo, setShowOracleInfo] = useState(false);
  const [showInterpretModal, setShowInterpretModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [interpretResult, setInterpretResult] = useState<InterpretResult | null>(null);
  const [game, dispatch] = useGameReducer();
  const deckRef = useRef<HTMLDivElement>(null);
  const readingRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 3: Add `handleCloseLoginModal` and `handleLoginSuccess` handlers**

Replace lines 109-113:

```tsx
  const handleCloseModal = useCallback(() => setShowInterpretModal(false), []);

  const handleResultReceived = useCallback((r: InterpretResult) => {
    setInterpretResult(r);
  }, []);
```

with:

```tsx
  const handleCloseModal = useCallback(() => setShowInterpretModal(false), []);

  const handleCloseLoginModal = useCallback(() => setShowLoginModal(false), []);

  const handleLoginSuccess = useCallback(() => {
    setShowLoginModal(false);
    router.refresh();
    setShowInterpretModal(true);
  }, [router]);

  const handleResultReceived = useCallback((r: InterpretResult) => {
    setInterpretResult(r);
  }, []);
```

- [ ] **Step 4: Add the "Login to Get Interpretation" button**

Replace lines 437-447:

```tsx
                {user && (
                  <button
                    className="px-10 py-4 bg-gradient-to-br from-[#8a2be2]/80 to-[#5a1a9e]/80 text-[#e6d5b8] rounded-lg
                               shadow-lg hover:shadow-[#8a2be2]/40 transition-all duration-300 font-bold text-lg
                               hover:scale-105 active:scale-95 border border-[#8a2be2]/40"
                    style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.1em' }}
                    onClick={() => setShowInterpretModal(true)}
                  >
                    ✦ Oracle Interpretation ✦
                  </button>
                )}
```

with:

```tsx
                {user ? (
                  <button
                    className="px-10 py-4 bg-gradient-to-br from-[#8a2be2]/80 to-[#5a1a9e]/80 text-[#e6d5b8] rounded-lg
                               shadow-lg hover:shadow-[#8a2be2]/40 transition-all duration-300 font-bold text-lg
                               hover:scale-105 active:scale-95 border border-[#8a2be2]/40"
                    style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.1em' }}
                    onClick={() => setShowInterpretModal(true)}
                  >
                    ✦ Oracle Interpretation ✦
                  </button>
                ) : (
                  <button
                    className="px-10 py-4 bg-gradient-to-br from-[#8a2be2]/80 to-[#5a1a9e]/80 text-[#e6d5b8] rounded-lg
                               shadow-lg hover:shadow-[#8a2be2]/40 transition-all duration-300 font-bold text-lg
                               hover:scale-105 active:scale-95 border border-[#8a2be2]/40"
                    style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.1em' }}
                    onClick={() => setShowLoginModal(true)}
                  >
                    ✦ Login to Get Interpretation ✦
                  </button>
                )}
```

- [ ] **Step 5: Render `LoginToInterpretModal`**

Replace lines 505-512:

```tsx
    {showInterpretModal && completedReading && (
      <InterpretationModal
        reading={completedReading}
        onClose={handleCloseModal}
        initialResult={interpretResult}
        onResultReceived={handleResultReceived}
      />
    )}
    </>
  );
```

with:

```tsx
    {showInterpretModal && completedReading && (
      <InterpretationModal
        reading={completedReading}
        onClose={handleCloseModal}
        initialResult={interpretResult}
        onResultReceived={handleResultReceived}
      />
    )}

    {showLoginModal && completedReading && (
      <LoginToInterpretModal
        onClose={handleCloseLoginModal}
        onSuccess={handleLoginSuccess}
      />
    )}
    </>
  );
```

- [ ] **Step 6: Type-check and lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Manually verify the full flow in the browser**

Run: `npm run dev`, then in a browser where you are **logged out**:
1. Go to `/reading`, complete any reading (e.g. a 3-card spread).
2. Confirm the purple button reads "✦ Login to Get Interpretation ✦" (not "Oracle Interpretation").
3. Click it — confirm the login modal opens over the reading (reading stays visible behind the backdrop), with no page navigation (URL stays `/reading`).
4. Try an invalid password — confirm inline error shown, modal stays open, reading still intact.
5. Log in with valid credentials — confirm: modal closes, an interpretation modal opens and loads (spinner then result) with the correct cards from the reading you just did.
6. Close the interpretation modal, click "✦ New Reading ✦", complete a new reading — confirm the button now reads "✦ Oracle Interpretation ✦" (proving `router.refresh()` picked up the logged-in `user`).

- [ ] **Step 8: Commit**

```bash
git add src/components/TarotGame.tsx
git commit -m "feat: add inline login flow for logged-out users to get interpretations"
```
