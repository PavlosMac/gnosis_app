import { describe, it, expect, vi, afterEach } from "vitest";
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
