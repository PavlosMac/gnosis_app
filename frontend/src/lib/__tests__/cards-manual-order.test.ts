import { describe, it, expect } from "vitest";
import { MANUAL_DECK_ORDER, TAROT_DECK } from "@/lib/cards";

const names = MANUAL_DECK_ORDER.map((c) => c.name);

describe("MANUAL_DECK_ORDER", () => {
  it("contains every card exactly once", () => {
    expect(MANUAL_DECK_ORDER).toHaveLength(78);
    expect(new Set(MANUAL_DECK_ORDER.map((c) => c.idx)).size).toBe(78);
    expect(MANUAL_DECK_ORDER.every((c) => TAROT_DECK.includes(c))).toBe(true);
  });

  it("opens with the majors in order", () => {
    expect(names[0]).toBe("The Fool");
    expect(names[21]).toBe("The World");
  });

  it("then lays out pips by suit: Wands, Cups, Swords, Pentacles", () => {
    expect(names[22]).toBe("Ace of Wands");
    expect(names[31]).toBe("Ten of Wands");
    expect(names[32]).toBe("Ace of Cups");
    expect(names[42]).toBe("Ace of Swords");
    expect(names[52]).toBe("Ace of Pentacles");
    expect(names[61]).toBe("Ten of Pentacles");
  });

  it("ends with court cards grouped by suit as Knight, Queen, King, Page", () => {
    expect(names.slice(62)).toEqual([
      "Knight of Wands", "Queen of Wands", "King of Wands", "Page of Wands",
      "Knight of Cups", "Queen of Cups", "King of Cups", "Page of Cups",
      "Knight of Swords", "Queen of Swords", "King of Swords", "Page of Swords",
      "Knight of Pentacles", "Queen of Pentacles", "King of Pentacles", "Page of Pentacles",
    ]);
  });
});
