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
