import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import cfg from "@/lib/readings-config.json";
import type { SelectedCard } from "@/types/reading";

// next/image needs the Next runtime; a plain <img> is enough for markup checks
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => React.createElement("img", { alt: String(props.alt ?? "") }),
}));

const { default: Reading, isRelationship } = await import("@/components/Reading");
const { default: RelationshipLayout } = await import("@/components/RelationshipLayout");

const positionsOf = (name: string) =>
  cfg.readings.find((r) => r.name === name)!.positions!.map((p) => p.name);

const fakeCards = (n: number): SelectedCard[] =>
  Array.from({ length: n }, (_, i) => ({ idx: i, name: `Card ${i}`, reversed: false } as unknown as SelectedCard));

describe("Reading layout selection", () => {
  it("detects the Relationship spread from the config by pillar suffix", () => {
    expect(isRelationship(positionsOf("Relationship Reading"))).toBe(true);
    expect(isRelationship(positionsOf("Past, Present, Future"))).toBe(false);
    expect(isRelationship(positionsOf("Tree of Life"))).toBe(false);
  });

  it("renders the Relationship spread as a 3-column grid with 3 pillar headers and 9 cards", () => {
    const positions = positionsOf("Relationship Reading");
    const html = renderToStaticMarkup(
      <Reading selectedCards={fakeCards(9)} positions={positions} isComplete />
    );
    expect(html).toMatch(/<div class="grid grid-cols-3/);
    expect(html.match(/<h3[^>]*>(Querent|Relationship|Other)<\/h3>/g)).toHaveLength(3);
    expect(html.match(/tarot-card-container/g)).toHaveLength(9);
    // pillar order: first card of each column
    expect(html.indexOf("CURRENT BEHAVIOUR - QUERENT")).toBeLessThan(html.indexOf("CURRENT SITUATION - RELATIONSHIP"));
  });

  it("places cards by pillar suffix, not index, so a missing card does not shift pillars", () => {
    const positions = positionsOf("Relationship Reading").filter((p) => p !== "What is desired - querent");
    const html = renderToStaticMarkup(<RelationshipLayout selectedCards={fakeCards(8)} positions={positions} />);
    const other = html.indexOf("<h3");
    const otherHeader = html.indexOf(">Other<");
    // every "- OTHER" label appears after the Other header; none before it
    const firstOtherLabel = html.indexOf("- OTHER");
    expect(other).toBeGreaterThanOrEqual(0);
    expect(firstOtherLabel).toBeGreaterThan(otherHeader);
    expect(html.slice(0, otherHeader)).not.toMatch(/- OTHER/);
  });

  it("places cards by row, not by order of appearance, so a missing card leaves a gap in its own row", () => {
    const positions = positionsOf("Relationship Reading").filter((p) => p !== "What is desired - querent");
    const html = renderToStaticMarkup(<RelationshipLayout selectedCards={fakeCards(8)} positions={positions} />);
    // "How to proceed - querent" (row 2) must not shift up into row 1's slot:
    // it should still appear after "Current situation - relationship" and
    // "How to proceed - relationship" (both row 0/2 of the middle pillar),
    // not sandwiched between them.
    const relCurrent = html.indexOf("CURRENT SITUATION - RELATIONSHIP");
    const relDesired = html.indexOf("WHAT IS DESIRED - RELATIONSHIP");
    const querentProceed = html.indexOf("HOW TO PROCEED - QUERENT");
    expect(relCurrent).toBeGreaterThanOrEqual(0);
    expect(relDesired).toBeGreaterThanOrEqual(0);
    expect(querentProceed).toBeGreaterThanOrEqual(0);
    // row 1 (desired) of the middle pillar renders before row 2 (how to
    // proceed) of the querent pillar — if the missing card had shifted
    // "how to proceed - querent" up a row, it would render before "what is
    // desired - relationship" instead.
    expect(relDesired).toBeLessThan(querentProceed);
  });

  it("derives custom pillar names from templated positions: named headers, bare captions", async () => {
    const { buildNamedRelationshipPositions } = await import("@/lib/relationship-spread");
    const config = cfg.readings.find((r) => r.name === "Relationship Reading")!.positions!;
    const positions = buildNamedRelationshipPositions(config, {
      querent: "Alice",
      other: "Maria",
    }).map((p) => p.name);
    const html = renderToStaticMarkup(
      <Reading selectedCards={fakeCards(9)} positions={positions} isComplete />
    );
    expect(html).toMatch(/<div class="grid grid-cols-3/);
    expect(html.match(/<h3[^>]*>(Alice|Relationship|Maria)<\/h3>/g)).toHaveLength(3);
    // captions drop the name — the header carries it — and no pillar keyword appears
    expect(html).toContain("CURRENT BEHAVIOUR<");
    expect(html).not.toMatch(/- ALICE/);
    expect(html).not.toMatch(/- QUERENT/);
  });

  it("lays out legacy round-1/2 saved positions with named headers", () => {
    const positions = positionsOf("Relationship Reading").map((p) =>
      p.replace(/\s*-\s*(querent|other)\s*$/i, (m, key) =>
        ` (${key === "querent" ? "Alice" : "Maria"}) - ${key}`
      )
    );
    const html = renderToStaticMarkup(
      <Reading selectedCards={fakeCards(9)} positions={positions} isComplete />
    );
    expect(html).toMatch(/<div class="grid grid-cols-3/);
    expect(html.match(/<h3[^>]*>(Alice|Relationship|Maria)<\/h3>/g)).toHaveLength(3);
    expect(html).not.toMatch(/\(ALICE\)/);
  });

  it("keeps the default row for Career (5 inline)", () => {
    const positions = positionsOf("Career Reading");
    const html = renderToStaticMarkup(<Reading selectedCards={fakeCards(5)} positions={positions} isComplete />);
    expect(html).toMatch(/md:flex-row/);
    expect(html).not.toMatch(/grid-cols-3/);
  });
});
