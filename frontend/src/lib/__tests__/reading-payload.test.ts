import { describe, it, expect } from "vitest";
import { buildReadingPayload } from "@/lib/reading-payload";
import type { ReadingResult, SelectedCard } from "@/types/reading";

const card = (name: string, reversed = false): SelectedCard =>
  ({ name, reversed, idx: 0 } as SelectedCard);

const baseReading: ReadingResult = {
  readingType: "Three Card Spread",
  positions: {
    Past: card("The Fool"),
    Present: card("The Magician", true),
  },
};

describe("buildReadingPayload", () => {
  it("maps positions to cards with orientation", () => {
    const payload = buildReadingPayload(baseReading);
    expect(payload.spread_name).toBe("Three Card Spread");
    expect(payload.cards).toEqual([
      { name: "The Fool", position: "Past", orientation: "upright" },
      { name: "The Magician", position: "Present", orientation: "reversed" },
    ]);
  });

  it("includes position_description when provided", () => {
    const payload = buildReadingPayload({
      ...baseReading,
      positionDescriptions: { Past: "What came before" },
    });
    expect(payload.cards[0].position_description).toBe("What came before");
    expect(payload.cards[1]).not.toHaveProperty("position_description");
  });

  it("includes question only when trimmed length is at least 5", () => {
    expect(
      buildReadingPayload({ ...baseReading, question: "Will I find love?" }).question
    ).toBe("Will I find love?");
    expect(
      buildReadingPayload({ ...baseReading, question: "  hi  " })
    ).not.toHaveProperty("question");
    expect(buildReadingPayload(baseReading)).not.toHaveProperty("question");
  });

  it("includes birth_date when present", () => {
    expect(
      buildReadingPayload({ ...baseReading, birth_date: "1990-03-12" }).birth_date
    ).toBe("1990-03-12");
    expect(buildReadingPayload(baseReading)).not.toHaveProperty("birth_date");
  });

  it("strips life number suffixes for Significators only", () => {
    const sig: ReadingResult = {
      readingType: "Significators",
      positions: {
        "life number 1": card("The Empress"),
        "life number 2": card("The Emperor"),
        "court royal": card("Queen of Wands"),
      },
      positionDescriptions: { "life number 1": "d1", "life number 2": "d2" },
    };
    expect(buildReadingPayload(sig).cards.map((c) => c.position)).toEqual([
      "life number", "life number", "court royal",
    ]);
    expect(buildReadingPayload(sig).cards.map((c) => c.position_description)).toEqual(["d1", "d2", undefined]);

    const unnamed: ReadingResult = {
      readingType: "Three Card Open Question",
      positions: { "Card 1": card("The Fool"), "Card 2": card("The Magician") },
    };
    expect(buildReadingPayload(unnamed).cards.map((c) => c.position)).toEqual(["Card 1", "Card 2"]);
  });
});
