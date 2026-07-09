import { describe, it, expect } from "vitest";
import {
  DEFAULT_SETTINGS,
  depthBandLabel,
  toneBandLabel,
  generationInputsChanged,
} from "@/lib/interpretation-settings";

describe("band labels", () => {
  it("maps depth bands", () => {
    expect(depthBandLabel(0)).toBe("brief");
    expect(depthBandLabel(25)).toBe("brief");
    expect(depthBandLabel(26)).toBe("standard");
    expect(depthBandLabel(50)).toBe("standard");
    expect(depthBandLabel(51)).toBe("detailed");
    expect(depthBandLabel(75)).toBe("detailed");
    expect(depthBandLabel(76)).toBe("comprehensive");
    expect(depthBandLabel(100)).toBe("comprehensive");
  });

  it("maps tone bands", () => {
    expect(toneBandLabel(0)).toBe("gentle");
    expect(toneBandLabel(33)).toBe("gentle");
    expect(toneBandLabel(34)).toBe("balanced");
    expect(toneBandLabel(66)).toBe("balanced");
    expect(toneBandLabel(67)).toBe("direct");
    expect(toneBandLabel(100)).toBe("direct");
  });
});

describe("generationInputsChanged", () => {
  const baseline = { settings: DEFAULT_SETTINGS, context: "" };

  it("is false for identical inputs", () => {
    expect(
      generationInputsChanged(
        { settings: { ...DEFAULT_SETTINGS }, context: "" },
        baseline
      )
    ).toBe(false);
  });

  it("detects a settings change", () => {
    expect(
      generationInputsChanged(
        { settings: { ...DEFAULT_SETTINGS, depth: 20 }, context: "" },
        baseline
      )
    ).toBe(true);
    expect(
      generationInputsChanged(
        { settings: { ...DEFAULT_SETTINGS, style: "esoteric" }, context: "" },
        baseline
      )
    ).toBe(true);
    expect(
      generationInputsChanged(
        { settings: { ...DEFAULT_SETTINGS, tone: 90 }, context: "" },
        baseline
      )
    ).toBe(true);
  });

  it("detects a context change and ignores surrounding whitespace", () => {
    expect(
      generationInputsChanged(
        { settings: { ...DEFAULT_SETTINGS }, context: "recently divorced" },
        baseline
      )
    ).toBe(true);
    expect(
      generationInputsChanged(
        { settings: { ...DEFAULT_SETTINGS }, context: "  " },
        baseline
      )
    ).toBe(false);
  });
});
