import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { decanatesByMonth } from "@/lib/decanates";
import { COURT_ROYALS, getCourtRoyalEntry } from "@/lib/court-royals";
import { getCourtRoyal } from "@/lib/significators";
import { findCardByName } from "@/services/cardLookup";

// Independent statement of the Golden Dawn rule, used to check the table.
const RANK: Record<string, string> = {
  Two: "Queen", Three: "Queen", Ten: "Queen",
  Four: "King", Five: "King", Six: "King",
  Seven: "Knight", Eight: "Knight", Nine: "Knight",
};
const NEXT_SUIT: Record<string, string> = {
  Wands: "Pentacles", Pentacles: "Swords", Swords: "Cups", Cups: "Wands",
};
const ruleFor = (pip: string): string => {
  const [num, , suit] = pip.split(" ");
  const thirdDecan = ["Four", "Seven", "Ten"].includes(num);
  return `${RANK[num]} of ${thirdDecan ? NEXT_SUIT[suit] : suit}`;
};

const allPips = [...new Set(Object.values(decanatesByMonth).flat().map((d) => d.card))];

describe("court royal table", () => {
  it("covers every decan pip and matches the Golden Dawn rule", () => {
    expect(allPips).toHaveLength(36);
    for (const pip of allPips) {
      expect(getCourtRoyalEntry(pip)?.royal, pip).toBe(ruleFor(pip));
    }
  });

  it("gives each of the 12 royals exactly three pips, and all names resolve in the deck", () => {
    expect(COURT_ROYALS).toHaveLength(12);
    expect(new Set(COURT_ROYALS.map((r) => r.royal)).size).toBe(12);
    for (const entry of COURT_ROYALS) {
      expect(entry.pips).toHaveLength(3);
      expect(() => findCardByName(entry.royal)).not.toThrow();
    }
  });

  it("never yields a Page and returns null for a non-decan card", () => {
    expect(COURT_ROYALS.some((r) => r.royal.startsWith("Page"))).toBe(false);
    expect(getCourtRoyalEntry("The Fool")).toBeNull();
  });
});

describe("court royal table vs backend data", () => {
  const backend = JSON.parse(
    readFileSync(resolve(__dirname, "../../../../backend/src/lib/cards/court_royals.json"), "utf8")
  ) as { suits: Record<string, { name: string; meta: { rules?: string } }[]> };
  const NUMBERS: Record<string, string> = { "2": "Two", "3": "Three", "5": "Five", "6": "Six", "8": "Eight", "9": "Nine" };

  it("gives every ruling royal the pips the backend says it rules", () => {
    const ruling = Object.values(backend.suits).flat().filter((c) => c.meta.rules);
    expect(ruling).toHaveLength(12);
    for (const { name, meta } of ruling) {
      const [, a, b, suit] = meta.rules!.match(/^(\d) and (\d) of (\w+)$/)!;
      const entry = COURT_ROYALS.find((r) => r.royal === name.replace("Disks", "Pentacles"));
      const suitName = suit === "Disks" ? "Pentacles" : suit;
      expect(entry, name).toBeDefined();
      expect(entry!.pips, name).toEqual(
        expect.arrayContaining([`${NUMBERS[a]} of ${suitName}`, `${NUMBERS[b]} of ${suitName}`])
      );
    }
  });
});

describe("getCourtRoyal boundaries", () => {
  const royalOn = (month: number, day: number) => getCourtRoyal(day, month)?.card.name;

  it.each([
    [3, 10, "Knight of Cups"], [3, 11, "Queen of Wands"],
    [4, 10, "Queen of Wands"], [4, 11, "King of Pentacles"],
    [5, 10, "King of Pentacles"], [5, 11, "Knight of Swords"],
    [6, 10, "Knight of Swords"], [6, 11, "Queen of Cups"],
    [7, 11, "Queen of Cups"], [7, 12, "King of Wands"],
    [8, 11, "King of Wands"], [8, 12, "Knight of Pentacles"],
    [9, 11, "Knight of Pentacles"], [9, 12, "Queen of Swords"],
    [10, 12, "Queen of Swords"], [10, 13, "King of Cups"],
    [11, 12, "King of Cups"], [11, 13, "Knight of Wands"],
    [12, 12, "Knight of Wands"], [12, 13, "Queen of Pentacles"],
    [12, 31, "Queen of Pentacles"], [1, 1, "Queen of Pentacles"],
    [1, 9, "Queen of Pentacles"], [1, 10, "King of Swords"],
    [2, 8, "King of Swords"], [2, 9, "Knight of Cups"],
    [2, 29, "Knight of Cups"],
  ])("month %i day %i -> %s", (month, day, expected) => {
    expect(royalOn(month, day)).toBe(expected);
  });

  it("describes the ruled span", () => {
    expect(getCourtRoyal(15, 3)?.rules).toBe("Pisces 20° to Aries 20°");
  });

  it("resolves a royal for every calendar date", () => {
    const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    days.forEach((n, m) => {
      for (let d = 1; d <= n; d++) expect(getCourtRoyal(d, m + 1), `${m + 1}/${d}`).not.toBeNull();
    });
  });
});
