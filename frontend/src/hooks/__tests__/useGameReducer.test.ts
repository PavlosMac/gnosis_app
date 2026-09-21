import { describe, it, expect } from "vitest";
import { gameReducer, type GamePhase } from "@/hooks/useGameReducer";
import type { SelectedCard } from "@/types/reading";

const card = (idx: number, name = `Card ${idx}`, reversed = false): SelectedCard =>
  ({ idx, name, reversed, imageUrl: "", meaning: "" } as SelectedCard);

const POSITIONS = ["Past", "Present", "Future"];
const DESCS = { Past: "before", Present: "now", Future: "after" };
const setup: GamePhase = { phase: "setup" };
const manual = (cards: SelectedCard[]): GamePhase => ({ phase: "manual-select", selectedCards: cards });
const complete = (question?: string) =>
  ({ type: "MANUAL_COMPLETE", positions: POSITIONS, readingName: "PPF", question, positionDescriptions: DESCS } as const);

describe("gameReducer — manual entry", () => {
  it("START_MANUAL_ENTRY only from setup", () => {
    expect(gameReducer(setup, { type: "START_MANUAL_ENTRY" })).toEqual(manual([]));
    const selecting: GamePhase = { phase: "selecting", selectedCards: [] };
    expect(gameReducer(selecting, { type: "START_MANUAL_ENTRY" })).toBe(selecting);
  });

  it("MANUAL_ADD_CARD appends, dedups by idx, caps at numCards and never leaves manual-select", () => {
    let s = gameReducer(manual([]), { type: "MANUAL_ADD_CARD", card: card(5), numCards: 2 });
    expect(s).toEqual(manual([card(5)]));
    const dup = gameReducer(s, { type: "MANUAL_ADD_CARD", card: card(5), numCards: 2 });
    expect(dup).toBe(s);
    s = gameReducer(s, { type: "MANUAL_ADD_CARD", card: card(9), numCards: 2 });
    expect(s).toEqual(manual([card(5), card(9)]));
    const over = gameReducer(s, { type: "MANUAL_ADD_CARD", card: card(1), numCards: 2 });
    expect(over).toBe(s);
  });

  it("MANUAL_TOGGLE_ORIENTATION flips only the matching card", () => {
    const s = gameReducer(manual([card(1), card(2)]), { type: "MANUAL_TOGGLE_ORIENTATION", cardIdx: 2 });
    expect(s).toEqual(manual([card(1), card(2, "Card 2", true)]));
    const back = gameReducer(s, { type: "MANUAL_TOGGLE_ORIENTATION", cardIdx: 2 });
    expect(back).toEqual(manual([card(1), card(2)]));
  });

  it("MANUAL_REMOVE_CARD preserves the order of the rest", () => {
    const s = gameReducer(manual([card(1), card(2), card(3)]), { type: "MANUAL_REMOVE_CARD", cardIdx: 2 });
    expect(s).toEqual(manual([card(1), card(3)]));
  });

  it("MANUAL_COMPLETE no-ops while incomplete", () => {
    const s = manual([card(1), card(2)]);
    expect(gameReducer(s, complete())).toBe(s);
  });

  it("MANUAL_COMPLETE builds the reading and lands directly in reading", () => {
    const cards = [card(1), card(2, "Card 2", true), card(3)];
    const s = gameReducer(manual(cards), complete("Will it rain?"));
    expect(s).toEqual({
      phase: "reading",
      selectedCards: cards,
      reading: {
        readingType: "PPF",
        positions: { Past: cards[0], Present: cards[1], Future: cards[2] },
        question: "Will it rain?",
        positionDescriptions: DESCS,
      },
    });
  });

  it("MANUAL_COMPLETE omits an empty question", () => {
    const s = gameReducer(manual([card(1), card(2), card(3)]), complete(undefined));
    expect(s.phase).toBe("reading");
    expect("question" in (s as { reading: object }).reading ? 1 : 0).toBe(0);
  });

  it("manual actions no-op outside manual-select", () => {
    const states: GamePhase[] = [
      setup,
      { phase: "selecting", selectedCards: [] },
      { phase: "reading", selectedCards: [card(1)], reading: { readingType: "x", positions: {} } },
    ];
    for (const s of states) {
      expect(gameReducer(s, { type: "MANUAL_ADD_CARD", card: card(1), numCards: 3 })).toBe(s);
      expect(gameReducer(s, { type: "MANUAL_TOGGLE_ORIENTATION", cardIdx: 1 })).toBe(s);
      expect(gameReducer(s, { type: "MANUAL_REMOVE_CARD", cardIdx: 1 })).toBe(s);
      expect(gameReducer(s, complete())).toBe(s);
    }
  });
});

describe("gameReducer — SELECT_CARD regression", () => {
  it("builds the same reading shape on the final card and moves to flipping", () => {
    const first = gameReducer({ phase: "selecting", selectedCards: [] }, {
      type: "SELECT_CARD", card: card(7), numCards: 2, positions: ["A", "B"], readingName: "Two", question: "q", positionDescriptions: { A: "a", B: "b" },
    });
    expect(first).toEqual({ phase: "selecting", selectedCards: [card(7)] });
    const done = gameReducer(first, {
      type: "SELECT_CARD", card: card(8), numCards: 2, positions: ["A", "B"], readingName: "Two", question: "q", positionDescriptions: { A: "a", B: "b" },
    });
    expect(done).toEqual({
      phase: "flipping",
      selectedCards: [card(7), card(8)],
      reading: { readingType: "Two", positions: { A: card(7), B: card(8) }, question: "q", positionDescriptions: { A: "a", B: "b" } },
    });
  });
});

describe("gameReducer — birth date", () => {
  it("BIRTHDATE_SUBMIT yields the chart including a court royal position", () => {
    const s = gameReducer(
      { phase: "birthdate-input", readingName: "Significators" } as GamePhase,
      { type: "BIRTHDATE_SUBMIT", day: 1, month: 5, year: 1990 }
    );
    expect(s.phase).toBe("reading");
    if (s.phase !== "reading") return;
    const keys = Object.keys(s.reading.positions);
    expect(keys).toContain("court royal");
    expect(s.reading.positions["court royal"].name).toBe("King of Pentacles");
    expect(s.selectedCards).toHaveLength(keys.length);
  });
});
