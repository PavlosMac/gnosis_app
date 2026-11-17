import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import cfg from "@/lib/readings-config.json";
import type { TarotCardData } from "@/types/models";
import type { SelectedCard } from "@/types/reading";

// next/image needs the Next runtime; a plain <img> is enough for markup checks
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) =>
    React.createElement("img", { alt: String(props.alt ?? "") }),
}));

const { default: Reading } = await import("@/components/Reading");
const { default: SpreadCards } = await import("@/components/SpreadCards");
const { default: TarotCard } = await import("@/components/TarotCard");
const { calculateSignificators } = await import("@/lib/significators");

const positionsOf = (name: string) =>
  cfg.readings.find((r) => r.name === name)!.positions!.map((p) => p.name);

const fakeCards = (n: number): SelectedCard[] =>
  Array.from(
    { length: n },
    (_, i) => ({ idx: i, name: `Card ${i}`, imageUrl: "", meaning: "", reversed: false }) as SelectedCard
  );

const visual = (name: string) => ({
  card: { idx: 0, name, imageUrl: "", meaning: "", reversedMeaning: "" } as TarotCardData,
  reversed: false,
});

const buttons = (html: string) => html.match(/<button type="button"[^>]*aria-haspopup="dialog"/g) ?? [];
const noop = () => {};

describe("TarotCard as a button", () => {
  it("is a plain card without a handler", () => {
    const html = renderToStaticMarkup(<TarotCard card={fakeCards(1)[0]} />);

    expect(html).not.toContain("<button");
  });

  it("is a labelled dialog button with one", () => {
    const html = renderToStaticMarkup(<TarotCard card={fakeCards(1)[0]} onSelect={noop} />);

    expect(html).toMatch(/^<button type="button"[^>]*aria-haspopup="dialog"[^>]*aria-label="About Card 0"/);
    expect(html.match(/tarot-card-container/g)).toHaveLength(1);
  });

  it("holds only phrasing content inside the button", () => {
    const html = renderToStaticMarkup(<TarotCard card={fakeCards(1)[0]} onSelect={noop} />);

    expect(html).not.toMatch(/<(div|h\d|p)[\s>]/);
  });

  it("keeps the plain card's heading and blocks", () => {
    const html = renderToStaticMarkup(<TarotCard card={fakeCards(1)[0]} />);

    expect(html).toContain("<h3");
  });

  it("announces a reversed card as reversed", () => {
    const upright = renderToStaticMarkup(<TarotCard card={fakeCards(1)[0]} onSelect={noop} />);
    const reversed = renderToStaticMarkup(
      <TarotCard card={{ ...fakeCards(1)[0], reversed: true }} onSelect={noop} />
    );

    expect(upright).toContain('aria-label="About Card 0"');
    expect(reversed).toContain('aria-label="About Card 0 (reversed)"');
  });
});

describe("the live spread", () => {
  it.each([
    ["Past, Present, Future", 3],
    ["Tree of Life", 11],
    ["Relationship Reading", 9],
  ])("makes every card of %s a button when a handler is given", (spread, n) => {
    const positions = positionsOf(spread);

    const html = renderToStaticMarkup(
      <Reading selectedCards={fakeCards(n)} positions={positions} isComplete onCardSelect={noop} />
    );

    expect(buttons(html)).toHaveLength(n);
  });

  it("leaves the cards plain without a handler", () => {
    const html = renderToStaticMarkup(
      <Reading selectedCards={fakeCards(3)} positions={positionsOf("Past, Present, Future")} isComplete />
    );

    expect(buttons(html)).toHaveLength(0);
  });

  it("never makes significator cards buttons", () => {
    const result = calculateSignificators(14, 7, 1985);
    const positions = ["star sign", "life number", "day number", "decanate", "court royal"];

    const html = renderToStaticMarkup(
      <Reading selectedCards={[]} positions={positions} significatorResult={result} onCardSelect={noop} />
    );

    expect(html).toContain("tarot-card-container");
    expect(buttons(html)).toHaveLength(0);
  });
});

describe("the saved spread", () => {
  it("makes the default row clickable, skipping unresolved cards", () => {
    const html = renderToStaticMarkup(
      <SpreadCards
        cardVisuals={{ Past: visual("The Fool"), Present: null, Future: visual("Justice") }}
        onCardSelect={noop}
      />
    );

    expect(buttons(html)).toHaveLength(2);
  });

  it("makes the Tree of Life clickable", () => {
    const visuals = Object.fromEntries(positionsOf("Tree of Life").map((p) => [p, visual("The Fool")]));

    expect(buttons(renderToStaticMarkup(<SpreadCards cardVisuals={visuals} onCardSelect={noop} />))).toHaveLength(11);
    expect(buttons(renderToStaticMarkup(<SpreadCards cardVisuals={visuals} />))).toHaveLength(0);
  });

  it("never makes a saved significator chart clickable", () => {
    const html = renderToStaticMarkup(
      <SpreadCards
        cardVisuals={{ "day number": visual("The Emperor"), "star sign": visual("The Emperor") }}
        onCardSelect={noop}
      />
    );

    expect(html).toContain("tarot-card-container");
    expect(buttons(html)).toHaveLength(0);
  });
});
