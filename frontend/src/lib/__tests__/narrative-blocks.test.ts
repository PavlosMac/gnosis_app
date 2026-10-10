import { describe, it, expect } from "vitest";
import { parseNarrative, splitBold } from "@/lib/narrative-blocks";

describe("parseNarrative", () => {
  it("splits card sections with bold headings and a closing paragraph", () => {
    const text =
      "**1. The Moon — Day Number 18**  \nTo be born on an 18 day.\n\n" +
      "**2. The High Priestess — Life Number**  \nAt the heart.\n\n" +
      "Taken together, this chart is lunar.";
    expect(parseNarrative(text)).toEqual([
      { heading: "1. The Moon — Day Number 18", paragraphs: ["To be born on an 18 day."] },
      { heading: "2. The High Priestess — Life Number", paragraphs: ["At the heart."] },
      { paragraphs: ["Taken together, this chart is lunar."] },
    ]);
  });

  it("handles hash headings, heading-only blocks and plain prose", () => {
    expect(parseNarrative("## The Sun\nBright.")).toEqual([
      { heading: "The Sun", paragraphs: ["Bright."] },
    ]);
    expect(parseNarrative("**Closing**")).toEqual([{ heading: "Closing", paragraphs: [] }]);
    expect(parseNarrative("One.\n\n\nTwo.\r\n\r\nThree.")).toEqual([
      { paragraphs: ["One."] }, { paragraphs: ["Two."] }, { paragraphs: ["Three."] },
    ]);
  });

  it("attaches a heading on its own paragraph to the text after it", () => {
    expect(parseNarrative("**The Empress**\n\nBody.\n\n**Closing**")).toEqual([
      { heading: "The Empress", paragraphs: ["Body."] },
      { heading: "Closing", paragraphs: [] },
    ]);
  });

  it("treats an unmarked 'Card — Position' title line followed by its body as a heading", () => {
    // The prompt asks for **Card — Position** on its own line; the model sometimes
    // drops the ** but keeps the shape, and stored narratives already have this form.
    const text =
      "The Moon — Day Number\nBorn on an 18 day, you carry a temperament shaped by The Moon.\n\n" +
      "The High Priestess — Life Number\nAt the root of your life path, the reduced 2 appears.\n\n" +
      "Taken together, this chart is lunar.";
    expect(parseNarrative(text)).toEqual([
      { heading: "The Moon — Day Number", paragraphs: ["Born on an 18 day, you carry a temperament shaped by The Moon."] },
      { heading: "The High Priestess — Life Number", paragraphs: ["At the root of your life path, the reduced 2 appears."] },
      { paragraphs: ["Taken together, this chart is lunar."] },
    ]);
  });

  it("does not treat hard-wrapped prose as a heading", () => {
    const cases: [string, string][] = [
      ["You are likely to sense undercurrents before others name them.\nThe gift is realism.",
        "You are likely to sense undercurrents before others name them. The gift is realism."],
      ["Born between instinct and civilization,\ndream and daylight.",
        "Born between instinct and civilization, dream and daylight."],
      ["You are likely to sense undercurrents before others name\nthem. The gift is realism.",
        "You are likely to sense undercurrents before others name them. The gift is realism."],
      ["\"Born between instinct and civilization\"\ndream and daylight.",
        "\"Born between instinct and civilization\" dream and daylight."],
      ["- The Moon\n- The Sun", "- The Moon - The Sun"],
      ["The Moon — porous to atmosphere, rarely satisfied by surface explanations.\nThe gift is realism.",
        "The Moon — porous to atmosphere, rarely satisfied by surface explanations. The gift is realism."],
    ];
    for (const [input, joined] of cases) {
      expect(parseNarrative(input), input).toEqual([{ paragraphs: [joined] }]);
    }
  });

  it("leaves an inline bold run that spans a line break as a paragraph", () => {
    expect(parseNarrative("**The Moon** returns for your sign\nwith force.")).toEqual([
      { paragraphs: ["**The Moon** returns for your sign with force."] },
    ]);
  });

  it("does not treat a paragraph that merely starts bold as a heading", () => {
    expect(parseNarrative("**The Moon** returns for your sign.")).toEqual([
      { paragraphs: ["**The Moon** returns for your sign."] },
    ]);
  });
});

describe("splitBold", () => {
  it("separates bold runs", () => {
    expect(splitBold("a **b** c")).toEqual([
      { text: "a ", bold: false }, { text: "b", bold: true }, { text: " c", bold: false },
    ]);
  });
});
