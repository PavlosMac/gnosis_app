import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import cfg from "@/lib/readings-config.json";
import type { TarotCardData } from "@/types/models";
import type { SelectedCard, SpreadCardSelection } from "@/types/reading";

// There is no DOM to click in, so TarotCard is replaced by a recorder: each rendered card
// leaves its onSelect here, and the test calls it as a click would.
const rendered: { name: string; onSelect?: () => void }[] = [];
vi.mock("@/components/TarotCard", () => ({
  default: ({ card, onSelect }: { card: TarotCardData; onSelect?: () => void }) => {
    rendered.push({ name: card.name, onSelect });
    return null;
  },
}));

const { default: Reading } = await import("@/components/Reading");
const { default: SpreadCards } = await import("@/components/SpreadCards");

const positionsOf = (name: string) =>
  cfg.readings.find((r) => r.name === name)!.positions!.map((p) => p.name);

const card = (name: string, idx: number, reversed = false): SelectedCard =>
  ({ idx, name, imageUrl: "", meaning: "", reversed }) as SelectedCard;

const click = (name: string) => rendered.find((r) => r.name === name)!.onSelect!();

describe("what a clicked spread card reports", () => {
  const selections: SpreadCardSelection[] = [];
  const onCardSelect = (s: SpreadCardSelection) => selections.push(s);

  beforeEach(() => {
    rendered.length = 0;
    selections.length = 0;
  });

  it("default row: the card, its orientation and its position", () => {
    renderToStaticMarkup(
      <Reading
        selectedCards={[card("The Fool", 40), card("Justice", 7, true), card("The Sun", 2)]}
        positions={positionsOf("Past, Present, Future")}
        onCardSelect={onCardSelect}
      />
    );

    click("Justice");

    expect(selections).toHaveLength(1);
    expect(selections[0]).toMatchObject({ reversed: true, position: "Present" });
    expect(selections[0].card.name).toBe("Justice");
  });

  it("Tree of Life: reports the spread's own position string, not the slot label", () => {
    const positions = positionsOf("Tree of Life").map((p) => (p === "Chesed" ? " Chesed" : p));
    const cards = positions.map((_, i) => card(`Card ${i}`, i));

    renderToStaticMarkup(<Reading selectedCards={cards} positions={positions} onCardSelect={onCardSelect} />);
    click(`Card ${positions.indexOf(" Chesed")}`);

    expect(selections[0].position).toBe(" Chesed");
  });

  it("Relationship: reports the full position string", () => {
    const positions = positionsOf("Relationship Reading");
    const cards = positions.map((_, i) => card(`Card ${i}`, i));

    renderToStaticMarkup(<Reading selectedCards={cards} positions={positions} onCardSelect={onCardSelect} />);
    click("Card 4");

    expect(selections[0].position).toBe(positions[4]);
  });

  it("saved default row: carries the stored position description", () => {
    const fool = { idx: 0, name: "The Fool", imageUrl: "", meaning: "" } as TarotCardData;

    renderToStaticMarkup(
      <SpreadCards
        cardVisuals={{ Past: { card: fool, reversed: true, description: "What led here" } }}
        onCardSelect={onCardSelect}
      />
    );
    click("The Fool");

    expect(selections[0]).toMatchObject({
      reversed: true,
      position: "Past",
      positionDescription: "What led here",
    });
  });

  it("saved Tree of Life: carries the description and the orientation", () => {
    const visuals = Object.fromEntries(
      positionsOf("Tree of Life").map((p, i) => [
        p,
        {
          card: { idx: 0, name: `Card ${i}`, imageUrl: "", meaning: "" } as TarotCardData,
          reversed: p === "Kether",
          description: `About ${p}`,
        },
      ])
    );

    renderToStaticMarkup(<SpreadCards cardVisuals={visuals} onCardSelect={onCardSelect} />);
    click(`Card ${positionsOf("Tree of Life").indexOf("Kether")}`);

    expect(selections[0]).toMatchObject({
      reversed: true,
      position: "Kether",
      positionDescription: "About Kether",
    });
  });
});
