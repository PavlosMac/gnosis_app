import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { TarotCardData } from "@/types/models";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => React.createElement("img", { alt: String(props.alt ?? "") }),
}));

const { default: SpreadCards } = await import("@/components/SpreadCards");
const { default: SignificatorsLayout } = await import("@/components/SignificatorsLayout");
const { calculateSignificators } = await import("@/lib/significators");

const visual = (name: string) => ({
  card: { idx: 0, name, imageUrl: "", meaning: "", reversedMeaning: "" } as TarotCardData,
  reversed: false,
});

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("SpreadCards significators layout", () => {
  const visuals = {
    "day number": visual("The Emperor"),
    "star sign": visual("The Emperor"),
    "life number 1": visual("The Empress"),
    "life number 2": visual("The Tower"),
    "decanate": visual("Four of Wands"),
    "court royal": visual("King of Pentacles"),
  };

  it("groups life number cards under one Life Numbers banner with no numbers", () => {
    const html = renderToStaticMarkup(<SpreadCards cardVisuals={visuals} />);
    expect(count(html, "Life Numbers")).toBe(1);
    expect(html).not.toMatch(/life number \d/i);
    expect(html).toContain("Court Royal");
    expect(count(html, "<img")).toBe(6);
  });

  it("renders the new un-numbered shape (re-keyed) the same as the legacy shape", () => {
    const modern = {
      "day number": visuals["day number"],
      "life number 1": visuals["life number 1"],
      "life number 2": visuals["life number 2"],
    };
    const html = renderToStaticMarkup(<SpreadCards cardVisuals={modern} />);
    expect(count(html, "Life Numbers")).toBe(1);
    expect(count(html, "<img")).toBe(3);
  });

  it("omits the Court Royal banner for older readings without one", () => {
    const { "court royal": _drop, ...older } = visuals;
    void _drop;
    const html = renderToStaticMarkup(<SpreadCards cardVisuals={older} />);
    expect(html).not.toContain("Court Royal");
  });

  it("keeps unresolved cards and unrecognised positions visible", () => {
    const html = renderToStaticMarkup(
      <SpreadCards cardVisuals={{ "day number": visual("The Emperor"), "star sign": null, mystery: visual("The Fool") }} />
    );
    expect(html).toContain("star sign");
    expect(html).toContain("Other");
    expect(count(html, "<img")).toBe(2);
  });

  it("leaves other spreads as a captioned row", () => {
    const html = renderToStaticMarkup(
      <SpreadCards cardVisuals={{ Past: visual("The Fool"), Present: visual("The Magician") }} />
    );
    expect(html).toContain("Past");
    expect(html).not.toContain("Life Numbers");
  });
});

describe("SignificatorsLayout", () => {
  it("shows Life Numbers and Court Royal banners", () => {
    const html = renderToStaticMarkup(
      <SignificatorsLayout significatorResult={calculateSignificators(1990, 5, 1)} />
    );
    expect(html).toContain("Life Numbers");
    expect(html).toContain("Court Royal");
    expect(html).toContain("King of Pentacles");
  });
});
