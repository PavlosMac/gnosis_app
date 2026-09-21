import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import cfg from "@/lib/readings-config.json";
import type { ReadingConfig } from "@/types/reading";

// SpreadPreview imports Reading (for isTreeOfLife), which pulls in next/image
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => React.createElement("img", { alt: String(props.alt ?? "") }),
}));

const { default: SpreadPreview } = await import("@/components/SpreadPreview");

const readingOf = (name: string) =>
  cfg.readings.find((r) => r.name === name)! as ReadingConfig;

const render = (name: string) =>
  renderToStaticMarkup(<SpreadPreview reading={readingOf(name)} />);

const slotCount = (html: string) => html.match(/spread-preview-slot/g)?.length ?? 0;

describe("SpreadPreview layout shapes", () => {
  it("renders Career as a plain wrap of 5 named slots", () => {
    const html = render("Career Reading");
    expect(slotCount(html)).toBe(5);
    expect(html).not.toMatch(/grid-cols-3/);
    expect(html).toContain("Current status");
    expect(html).toContain("Action steps");
  });

  it("renders Relationship as a 3-column grid with pillar headers and suffix-free labels", () => {
    const html = render("Relationship Reading");
    expect(html).toMatch(/grid grid-cols-3/);
    expect(slotCount(html)).toBe(9);
    for (const label of ["Querent", "Relationship", "Other"]) {
      expect(html).toContain(label);
    }
    // cell labels drop the pillar suffix — the header already names it
    expect(html).not.toMatch(/- querent/i);
    expect(html).toContain("Current behaviour");
  });

  it("renders custom pillar names as Relationship column headers", () => {
    const html = renderToStaticMarkup(
      <SpreadPreview
        reading={readingOf("Relationship Reading")}
        pillarLabels={{ querent: "Alice", other: "Maria" }}
      />
    );
    expect(html).toContain("Alice");
    expect(html).toContain("Maria");
    expect(html).toContain("Relationship");
    expect(html).not.toContain("Querent");
    expect(html).not.toContain("Other");
  });

  it("renders Tree of Life as 11 slots in Kabbalah row order", () => {
    const html = render("Tree of Life");
    expect(slotCount(html)).toBe(11);
    expect(html.indexOf("Kether")).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("Kether")).toBeLessThan(html.indexOf("Malkuth"));
    // Daath sits between the Binah/Chokmah and Geburah/Chesed rows
    expect(html.indexOf("Chokmah")).toBeLessThan(html.indexOf("Daath"));
    expect(html.indexOf("Daath")).toBeLessThan(html.indexOf("Geburah"));
  });

  it("synthesizes Card 1..N slots for spreads without named positions", () => {
    const html = render("Three Card Open Question");
    expect(slotCount(html)).toBe(3);
    for (const label of ["Card 1", "Card 2", "Card 3"]) {
      expect(html).toContain(label);
    }
  });

  it("renders the 5 Significator slots with the birth-date note", () => {
    const html = render("Significators");
    expect(slotCount(html)).toBe(5);
    expect(html).toContain("court royal");
    expect(html).toContain("star sign");
    expect(html).toContain("decanate");
    expect(html).toContain("Derived from your birth date");
  });
});
