import { describe, expect, it, vi } from "vitest";
import {
  FREE_READINGS_PER_BROWSER,
  FREE_SIGNIFICATORS_PER_BROWSER,
  FREE_TRIALS,
  hasReachedFreeLimit,
  readFreeUses,
  recordFreeUse,
  recordVisitorUse,
  shouldShowFreeLimit,
} from "@/lib/free-trials";

/** In-memory stand-in for window.localStorage */
const memoryStorage = (seed: Record<string, string> = {}) => {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
};

const throwingStorage = {
  getItem: () => {
    throw new Error("storage disabled");
  },
  setItem: () => {
    throw new Error("storage disabled");
  },
};

describe("free trial limits", () => {
  it("allows three readings and two significator charts per browser", () => {
    expect(FREE_READINGS_PER_BROWSER).toBe(3);
    expect(FREE_SIGNIFICATORS_PER_BROWSER).toBe(2);
    expect(FREE_TRIALS.reading).toEqual({ key: "tarot:free-readings-used", limit: 3 });
    expect(FREE_TRIALS.significators).toEqual({ key: "tarot:free-significators-used", limit: 2 });
  });
});

describe("readFreeUses", () => {
  it("is 0 when nothing is stored", () => {
    expect(readFreeUses(FREE_TRIALS.reading, memoryStorage())).toBe(0);
  });

  it("reads the stored integer", () => {
    const storage = memoryStorage({ "tarot:free-readings-used": "2" });
    expect(readFreeUses(FREE_TRIALS.reading, storage)).toBe(2);
  });

  it("treats a malformed or negative value as 0", () => {
    expect(readFreeUses(FREE_TRIALS.reading, memoryStorage({ "tarot:free-readings-used": "many" }))).toBe(0);
    expect(readFreeUses(FREE_TRIALS.reading, memoryStorage({ "tarot:free-readings-used": "-4" }))).toBe(0);
    expect(readFreeUses(FREE_TRIALS.reading, memoryStorage({ "tarot:free-readings-used": "1.5" }))).toBe(0);
  });

  it("is 0 when storage throws", () => {
    expect(readFreeUses(FREE_TRIALS.reading, throwingStorage)).toBe(0);
  });

  it("keeps the two counters apart", () => {
    const storage = memoryStorage({ "tarot:free-readings-used": "3" });
    expect(readFreeUses(FREE_TRIALS.significators, storage)).toBe(0);
  });
});

describe("recordFreeUse", () => {
  it("increments the stored count and returns the new value", () => {
    const storage = memoryStorage();
    expect(recordFreeUse(FREE_TRIALS.significators, storage)).toBe(1);
    expect(recordFreeUse(FREE_TRIALS.significators, storage)).toBe(2);
    expect(storage.data.get("tarot:free-significators-used")).toBe("2");
  });

  it("does not throw when storage throws", () => {
    expect(() => recordFreeUse(FREE_TRIALS.reading, throwingStorage)).not.toThrow();
  });
});

describe("hasReachedFreeLimit", () => {
  it("is false below the limit", () => {
    const storage = memoryStorage({ "tarot:free-readings-used": "2" });
    expect(hasReachedFreeLimit(FREE_TRIALS.reading, storage)).toBe(false);
  });

  it("is true at exactly the limit", () => {
    const storage = memoryStorage({ "tarot:free-readings-used": "3" });
    expect(hasReachedFreeLimit(FREE_TRIALS.reading, storage)).toBe(true);
  });

  it("is true above the limit", () => {
    const storage = memoryStorage({ "tarot:free-significators-used": "7" });
    expect(hasReachedFreeLimit(FREE_TRIALS.significators, storage)).toBe(true);
  });

  it("never blocks when storage is unavailable", () => {
    expect(hasReachedFreeLimit(FREE_TRIALS.reading, throwingStorage)).toBe(false);
  });
});

describe("shouldShowFreeLimit", () => {
  const spent = () => memoryStorage({ "tarot:free-readings-used": "3" });

  it("gates a visitor whose free uses are spent", () => {
    expect(shouldShowFreeLimit(FREE_TRIALS.reading, false, spent())).toBe(true);
  });

  it("lets a visitor start while uses remain", () => {
    const storage = memoryStorage({ "tarot:free-readings-used": "2" });
    expect(shouldShowFreeLimit(FREE_TRIALS.reading, false, storage)).toBe(false);
  });

  it("never gates a logged-in user, whatever the counter says", () => {
    expect(shouldShowFreeLimit(FREE_TRIALS.reading, true, spent())).toBe(false);
  });

  it("does not gate when storage is unavailable", () => {
    expect(shouldShowFreeLimit(FREE_TRIALS.reading, false, throwingStorage)).toBe(false);
  });
});

describe("recordVisitorUse", () => {
  it("counts a visitor's use", () => {
    const storage = memoryStorage();
    expect(recordVisitorUse(FREE_TRIALS.reading, false, storage)).toBe(true);
    expect(storage.data.get("tarot:free-readings-used")).toBe("1");
  });

  it("writes nothing for a logged-in user", () => {
    const storage = memoryStorage();
    expect(recordVisitorUse(FREE_TRIALS.reading, true, storage)).toBe(false);
    expect(storage.data.size).toBe(0);
  });

  it("reaches the gate after exactly the limit of counted uses", () => {
    const storage = memoryStorage();
    for (let i = 0; i < FREE_TRIALS.significators.limit; i++) {
      expect(shouldShowFreeLimit(FREE_TRIALS.significators, false, storage)).toBe(false);
      recordVisitorUse(FREE_TRIALS.significators, false, storage);
    }
    expect(shouldShowFreeLimit(FREE_TRIALS.significators, false, storage)).toBe(true);
  });
});

describe("default browser storage", () => {
  it("is treated as nothing counted when reading window.localStorage throws", () => {
    const blocked = { get localStorage(): never { throw new Error("SecurityError"); } };
    vi.stubGlobal("window", blocked);
    try {
      expect(readFreeUses(FREE_TRIALS.reading)).toBe(0);
      expect(hasReachedFreeLimit(FREE_TRIALS.reading)).toBe(false);
      expect(() => recordFreeUse(FREE_TRIALS.reading)).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
