import { describe, it, expect } from "vitest";
import cfg from "@/lib/readings-config.json";
import { isBirthdateSpread, pickableSpreads, resolvePositions } from "@/lib/reading-positions";
import type { ReadingConfig } from "@/types/reading";

const readings = cfg.readings as ReadingConfig[];

describe("isBirthdateSpread", () => {
  it("is true only for a spread explicitly flagged birthDate", () => {
    expect(isBirthdateSpread({ name: "x", birthDate: true })).toBe(true);
    expect(isBirthdateSpread({ name: "x", cards: 3 })).toBe(false);
  });

  it("does not treat a spread that merely omits cards as birth-date based", () => {
    expect(isBirthdateSpread({ name: "x" })).toBe(false);
  });

  it("marks Significators, and only Significators, as birth-date based", () => {
    const birthdate = readings.filter(isBirthdateSpread).map((r) => r.name);
    expect(birthdate).toEqual(["Significators"]);
    for (const r of readings.filter((r) => !isBirthdateSpread(r))) {
      expect(r.cards, r.name).toBeGreaterThan(0);
    }
  });

  it("gives Significators five named positions including the court royal", () => {
    const sig = readings.find((r) => r.name === "Significators")!;
    expect(resolvePositions(sig).map((p) => p.name)).toEqual([
      "star sign", "life number", "day number", "decanate", "court royal",
    ]);
  });
});

describe("pickableSpreads", () => {
  const names = (list: ReadingConfig[]) => list.map((r) => r.name);

  it("hides the login-only spreads from a visitor and keeps the rest in config order", () => {
    expect(names(pickableSpreads(readings, false))).toEqual([
      "Single Card",
      "Past, Present, Future",
      "Fire, Water, Air, Earth",
      "Two Card",
      "Three Card",
    ]);
  });

  it("offers every spread to a logged-in user", () => {
    expect(names(pickableSpreads(readings, true))).toEqual(names(readings));
  });

  it("gates exactly Relationship, Career, Tree of Life and Significators", () => {
    expect(names(readings.filter((r) => r.requiresLogin))).toEqual([
      "Relationship Reading",
      "Career Reading",
      "Tree of Life",
      "Significators",
    ]);
  });
});
