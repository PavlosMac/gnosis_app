import { describe, it, expect, vi, afterEach } from "vitest";
import {
  DEFAULT_SETTINGS,
  readDefaultSettings,
  writeDefaultSettings,
  estimatedWordsPerCard,
  settingsEqual,
} from "@/lib/interpretation-defaults";
import type { InterpretationSettings } from "@/types/interpret";

const settings: InterpretationSettings = {
  lens: "esoteric",
  intent: "predictive",
  depth: 80,
};

const fakeStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
};

describe("sticky default settings", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("falls back to DEFAULT_SETTINGS when window is undefined", () => {
    expect(() => writeDefaultSettings(settings)).not.toThrow();
    expect(readDefaultSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips through localStorage", () => {
    vi.stubGlobal("window", { localStorage: fakeStorage() });
    expect(readDefaultSettings()).toEqual(DEFAULT_SETTINGS);
    writeDefaultSettings(settings);
    expect(readDefaultSettings()).toEqual(settings);
  });

  it("falls back on malformed or invalid stored values", () => {
    const storage = fakeStorage();
    vi.stubGlobal("window", { localStorage: storage });

    storage.setItem("interpretation-default-settings", "{not json");
    expect(readDefaultSettings()).toEqual(DEFAULT_SETTINGS);

    // old settings shape (style/depth/tone) must not leak through
    storage.setItem(
      "interpretation-default-settings",
      JSON.stringify({ style: "reflective", depth: 60, tone: 50 })
    );
    expect(readDefaultSettings()).toEqual(DEFAULT_SETTINGS);

    storage.setItem(
      "interpretation-default-settings",
      JSON.stringify({ lens: "esoteric", intent: "predictive", depth: 101 })
    );
    expect(readDefaultSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("swallows storage write failures (sticky default is best-effort)", () => {
    vi.stubGlobal("window", {
      localStorage: {
        setItem: () => {
          throw new DOMException("quota", "QuotaExceededError");
        },
        getItem: () => null,
      },
    });
    expect(() => writeDefaultSettings(settings)).not.toThrow();
  });
});

describe("estimatedWordsPerCard", () => {
  it("matches the agreed budget model (30% synthesis share)", () => {
    // depth 60: total = 150 + 1050 × 0.6 = 780; per card = 780 × 0.7 ÷ 3 = 182
    expect(estimatedWordsPerCard(60, 3)).toBe(182);
    // depth 0: total = 150; per card = 105 for a single card
    expect(estimatedWordsPerCard(0, 1)).toBe(105);
    // depth 100: total = 1200; per card = 840 ÷ 10 = 84
    expect(estimatedWordsPerCard(100, 10)).toBe(84);
  });

  it("shrinks per-card share as the spread grows", () => {
    expect(estimatedWordsPerCard(60, 10)).toBeLessThan(estimatedWordsPerCard(60, 3));
  });

  it("returns 0 for an empty spread", () => {
    expect(estimatedWordsPerCard(60, 0)).toBe(0);
  });
});

describe("settingsEqual", () => {
  it("compares all three fields", () => {
    expect(settingsEqual(settings, { ...settings })).toBe(true);
    expect(settingsEqual(settings, { ...settings, lens: "traditional" })).toBe(false);
    expect(settingsEqual(settings, { ...settings, intent: "reflective" })).toBe(false);
    expect(settingsEqual(settings, { ...settings, depth: 10 })).toBe(false);
  });
});
