import { describe, it, expect } from "vitest";
import { basePosition, isSignificators, uniquePositionKeys } from "@/lib/significator-positions";

describe("basePosition", () => {
  it("strips the numeric suffix from life number keys only", () => {
    expect(basePosition("life number 2")).toBe("life number");
    expect(basePosition("Life Number 10")).toBe("Life Number");
    expect(basePosition("life number")).toBe("life number");
    expect(basePosition("Card 1")).toBe("Card 1");
    expect(basePosition("court royal")).toBe("court royal");
  });
});

describe("isSignificators", () => {
  it("accepts current, legacy and court royal positions", () => {
    expect(isSignificators(["life number", "life number"])).toBe(true);
    expect(isSignificators(["life number 1", "star sign"])).toBe(true);
    expect(isSignificators(["court royal"])).toBe(true);
    expect(isSignificators(["Past", "Present", "Future"])).toBe(false);
  });
});

describe("uniquePositionKeys", () => {
  it("suffixes repeated positions 1..N in order", () => {
    expect(
      uniquePositionKeys(["day number", "life number", "life number", "star sign"])
    ).toEqual(["day number", "life number 1", "life number 2", "star sign"]);
  });

  it("leaves unique positions and the legacy numbered shape untouched", () => {
    const legacy = ["day number", "life number 1", "life number 2", "decanate"];
    expect(uniquePositionKeys(legacy)).toEqual(legacy);
  });
});
