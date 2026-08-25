import { saveInterpretationSchema } from "@/lib/validation/interpret-schemas";
import { loginHrefFor } from "@/lib/auth-return-path";
import type { Interpretation } from "@/types/interpret";

// Holds an unsaved interpretation across a login round-trip when the session
// expired mid-flow. sessionStorage: survives navigation within the tab, not
// the tab itself — a deliberate, short-lived stash rather than a backup.
const stashKey = (readingId: string) => `interpretation-stash:${readingId}`;

export const stashUnsavedInterpretation = (
  readingId: string,
  interpretation: Interpretation
): void => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(stashKey(readingId), JSON.stringify(interpretation));
  } catch {
    // best-effort: storage blocked means the user re-generates after login
  }
};

// Reads and clears the stash in one step so a restore can only happen once
export const takeUnsavedInterpretation = (readingId: string): Interpretation | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(stashKey(readingId));
    if (!raw) return null;
    window.sessionStorage.removeItem(stashKey(readingId));
    const parsed = saveInterpretationSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

// After login, land on the reading page — the only place that restores the stash
export const loginToSaveHref = (readingId: string): string =>
  loginHrefFor(`/user/readings/${readingId}`);
