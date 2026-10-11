import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AboutSpreadList from "@/components/AboutSpreadList";
import SignificatorPositionCards from "@/components/SignificatorPositionCards";
import { aboutSpreads, significatorPositions } from "@/lib/about-content";

const escaped = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

describe("AboutSpreadList", () => {
  const spreads = aboutSpreads();
  const html = renderToStaticMarkup(<AboutSpreadList spreads={spreads} />);

  it("renders every spread in the order aboutSpreads() gives", () => {
    expect(html.match(/<li/g) ?? []).toHaveLength(spreads.length);
    const positions = spreads.map((s) => html.indexOf(`>${escaped(s.name)}<`));
    for (const p of positions) expect(p).toBeGreaterThan(-1);
    for (let i = 1; i < positions.length; i++) expect(positions[i]).toBeGreaterThan(positions[i - 1]);
  });

  it("labels the card count, singular, plural and birth date", () => {
    expect(html).toContain(">1 card<");
    expect(html).toContain(">9 cards<");
    expect(html).toContain(">Birth date<");
  });

  it("shows each config description and the blurbs that exist", () => {
    for (const s of spreads) expect(html).toContain(escaped(s.description));
    for (const s of spreads) if (s.blurb) expect(html).toContain(escaped(s.blurb));
  });
});

describe("SignificatorPositionCards", () => {
  const positions = significatorPositions();
  const html = renderToStaticMarkup(<SignificatorPositionCards positions={positions} />);

  it("renders the five positions with their symbols, titles and descriptions", () => {
    for (const p of positions) {
      expect(html).toContain(p.symbol);
      expect(html).toContain(escaped(p.title));
      expect(html).toContain(escaped(p.description));
    }
  });

  it("is one column on phones and two from sm", () => {
    const root = html.match(/^<div class="([^"]*)"/)![1].split(/\s+/);
    expect(root).toContain("grid-cols-1");
    expect(root).toContain("sm:grid-cols-2");
  });
});

describe("ArticleSection framed", () => {
  it("wraps the body in the saved-reading panel only when framed", async () => {
    const { default: ArticleSection } = await import("@/components/ArticleSection");
    const plain = renderToStaticMarkup(<ArticleSection title="T"><p>body</p></ArticleSection>);
    const framed = renderToStaticMarkup(<ArticleSection title="T" framed><p>body</p></ArticleSection>);
    expect(plain).not.toContain("rounded-2xl");
    const panel = framed.match(/<div class="([^"]*rounded-2xl[^"]*)"><p>body<\/p><\/div>/);
    expect(panel).not.toBeNull();
    const classes = panel![1].split(/\s+/);
    for (const c of ["border", "border-[#d4af37]/20", "bg-gradient-to-b", "from-[#1a0033]/80", "to-[#0a0015]/80", "p-5", "sm:p-8"]) {
      expect(classes).toContain(c);
    }
  });
});
