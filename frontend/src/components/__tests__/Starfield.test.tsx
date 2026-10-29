import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Starfield, { STAR_COUNT, buildStars } from "@/components/Starfield";

const css = readFileSync(resolve(__dirname, "../../app/tarot.css"), "utf8");

describe("Starfield", () => {
  it("renders a small, fixed set of static stars", () => {
    const html = renderToStaticMarkup(<Starfield />);
    expect(html.match(/data-star=""/g)).toHaveLength(STAR_COUNT);
    expect(STAR_COUNT).toBeLessThanOrEqual(40);
  });

  it("never animates: no animation class, delay or duration on any star", () => {
    const html = renderToStaticMarkup(<Starfield />);
    expect(html).not.toMatch(/animate-/);
    expect(html).not.toMatch(/animation/);
  });

  it("is decorative: hidden from assistive tech and never intercepts clicks", () => {
    const html = renderToStaticMarkup(<Starfield />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("pointer-events-none");
    expect(html).toContain("fixed inset-0");
  });

  it("places stars deterministically, so server and client markup match", () => {
    expect(buildStars()).toEqual(buildStars());
    expect(buildStars(2)[1]).toEqual({ left: "20.3%", top: "34.7%", opacity: 0.35 });
  });

  it("varies star brightness within a dim range so the sky has depth", () => {
    const opacities = buildStars().map((s) => s.opacity);
    expect(Math.min(...opacities)).toBeGreaterThanOrEqual(0.2);
    expect(Math.max(...opacities)).toBeLessThanOrEqual(0.6);
    expect(new Set(opacities).size).toBeGreaterThan(1);
  });
});

describe("tarot.css after the static starfield", () => {
  it("has no twinkle keyframe or class left", () => {
    expect(css).not.toContain("twinkle");
  });

  it("stops the decorative loops under prefers-reduced-motion", () => {
    const blocks = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}\n/g)].map((m) => m[0]);
    const decorative = blocks.find((b) => b.includes(".reading-card-reveal"));
    expect(decorative).toBeDefined();
    for (const cls of [".animate-fadeIn", ".tarot-card-container", ".reading-card-reveal"]) {
      expect(decorative).toContain(cls);
    }
    expect(decorative).toMatch(/animation:\s*none\s*!important/);
  });
});
