import { describe, it, expect, vi, afterEach } from "vitest";
import {
  stashUnsavedInterpretation,
  takeUnsavedInterpretation,
  loginToSaveHref,
} from "@/lib/interpretation-stash";
import type { Interpretation } from "@/types/interpret";

const interpretation: Interpretation = {
  card_interpretations: [
    { card_name: "The Fool", position: "Past", orientation: "upright", interpretation: "A leap." },
  ],
  synthesis: "The path is clear.",
  model: "test-model",
  tokens_used: 100,
  settings: { lens: "esoteric", intent: "predictive", depth: 80 },
};

const fakeStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
};

describe("interpretation stash", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is a no-op / null when window is undefined", () => {
    expect(() => stashUnsavedInterpretation("abc", interpretation)).not.toThrow();
    expect(takeUnsavedInterpretation("abc")).toBeNull();
  });

  it("round-trips once and clears itself on take", () => {
    vi.stubGlobal("window", { sessionStorage: fakeStorage() });
    stashUnsavedInterpretation("abc123", interpretation);
    expect(takeUnsavedInterpretation("other")).toBeNull();
    expect(takeUnsavedInterpretation("abc123")).toEqual(interpretation);
    expect(takeUnsavedInterpretation("abc123")).toBeNull();
  });

  it("returns null for malformed or invalid stored values", () => {
    const storage = fakeStorage();
    vi.stubGlobal("window", { sessionStorage: storage });
    storage.setItem("interpretation-stash:abc123", "{not json");
    expect(takeUnsavedInterpretation("abc123")).toBeNull();
    storage.setItem("interpretation-stash:abc123", JSON.stringify({ synthesis: "only" }));
    expect(takeUnsavedInterpretation("abc123")).toBeNull();
  });

  it("swallows storage write failures", () => {
    vi.stubGlobal("window", {
      sessionStorage: {
        setItem: () => {
          throw new DOMException("quota", "QuotaExceededError");
        },
        getItem: () => null,
        removeItem: () => {},
      },
    });
    expect(() => stashUnsavedInterpretation("abc123", interpretation)).not.toThrow();
  });
});

describe("loginToSaveHref", () => {
  it("returns to the reading detail page after login", () => {
    expect(loginToSaveHref("abc123")).toBe("/user/login?from=%2Fuser%2Freadings%2Fabc123");
  });
});
