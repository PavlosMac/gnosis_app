import { describe, expect, it } from "vitest";
import { getDayNumber, reduceToMajorArcana } from "@/lib/significators";

describe("reduceToMajorArcana", () => {
  it("keeps 1..22 and digit-sums only above 22", () => {
    expect(reduceToMajorArcana(21)).toBe(21);
    expect(reduceToMajorArcana(22)).toBe(22);
    expect(reduceToMajorArcana(23)).toBe(5);
    expect(reduceToMajorArcana(31)).toBe(4);
  });
});

describe("getDayNumber", () => {
  it("maps 1..21 to the major arcana by number", () => {
    expect(getDayNumber(1)).toMatchObject({ number: 1, card: { name: "The Magician" } });
    expect(getDayNumber(21)).toMatchObject({ number: 21, card: { name: "The World" } });
  });

  it("shows 22 as The Fool, never the first minor card (bugs.md 2026-11-03)", () => {
    expect(getDayNumber(22)).toMatchObject({ number: 22, card: { name: "The Fool" } });
  });

  it("reduces a day above 22 before the lookup", () => {
    expect(getDayNumber(23)).toMatchObject({ number: 5, card: { name: "The Hierophant" } });
    expect(getDayNumber(31)).toMatchObject({ number: 4, card: { name: "The Emperor" } });
  });
});
