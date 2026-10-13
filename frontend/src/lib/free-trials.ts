/*
 * Per-browser free-use counters behind the sign-up nudge.
 *
 * A visitor without a session can draw a few readings and a couple of
 * significator charts; after that the next attempt shows the FreeLimitPanel.
 * The counts live in localStorage only, are never sent to the server and
 * are not enforcement: anything that must hold (interpretations, saved
 * readings) is already behind an account and the backend. Storage access is
 * injected so the pure functions test without a DOM, and every call is
 * wrapped so a blocked or missing store means "nothing counted".
 */

export const FREE_READINGS_PER_BROWSER = 3;
export const FREE_SIGNIFICATORS_PER_BROWSER = 2;

export interface FreeTrial {
  /** localStorage key holding the integer count */
  key: string;
  /** Uses allowed before the nudge */
  limit: number;
}

export const FREE_TRIALS = {
  reading: { key: "tarot:free-readings-used", limit: FREE_READINGS_PER_BROWSER },
  significators: { key: "tarot:free-significators-used", limit: FREE_SIGNIFICATORS_PER_BROWSER },
} as const satisfies Record<string, FreeTrial>;

export type FreeTrialKind = keyof typeof FREE_TRIALS;

/** The slice of the Storage interface the counters need */
export interface CounterStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

// Merely reading window.localStorage can throw (blocked cookies, sandboxed frames)
const browserStorage = (): CounterStorage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

const parseCount = (raw: string | null): number => {
  if (raw === null || !/^\d+$/.test(raw)) return 0;
  return Number(raw);
};

/** How many times this trial has been used in this browser; 0 when unknown */
export const readFreeUses = (
  trial: FreeTrial,
  storage: CounterStorage | null = browserStorage()
): number => {
  try {
    return parseCount(storage?.getItem(trial.key) ?? null);
  } catch {
    return 0;
  }
};

/** Count one more use; returns the new total (or the old one if storage fails) */
export const recordFreeUse = (
  trial: FreeTrial,
  storage: CounterStorage | null = browserStorage()
): number => {
  const used = readFreeUses(trial, storage);
  try {
    storage?.setItem(trial.key, String(used + 1));
    return used + 1;
  } catch {
    return used;
  }
};

/** True once the free uses are spent. Unavailable storage never blocks. */
export const hasReachedFreeLimit = (
  trial: FreeTrial,
  storage: CounterStorage | null = browserStorage()
): boolean => readFreeUses(trial, storage) >= trial.limit;

/** True when a visitor (never a logged-in user) must see the nudge instead of starting */
export const shouldShowFreeLimit = (
  trial: FreeTrial,
  isLoggedIn: boolean,
  storage: CounterStorage | null = browserStorage()
): boolean => !isLoggedIn && hasReachedFreeLimit(trial, storage);

/** Count a use for a visitor; logged-in users are never written. Returns whether it counted. */
export const recordVisitorUse = (
  trial: FreeTrial,
  isLoggedIn: boolean,
  storage: CounterStorage | null = browserStorage()
): boolean => {
  if (isLoggedIn) return false;
  recordFreeUse(trial, storage);
  return true;
};
