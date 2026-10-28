import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ShuffleOrbit from "@/components/ShuffleOrbit";
import ShuffleAnimation from "@/components/ShuffleAnimation";

// Every element with a shuffle-card class token, with its class list and inline style
const cards = (html: string) =>
  [...html.matchAll(/<div class="([^"]*)" style="([^"]*)"/g)]
    .map(([, classes, style]) => ({ classes: classes.split(" "), style }))
    .filter(({ classes }) => classes.includes("shuffle-card"));

describe("ShuffleOrbit", () => {
  it("circles ten cards around the ankh once, by default", () => {
    const html = renderToStaticMarkup(<ShuffleOrbit />);
    expect(cards(html)).toHaveLength(10);
    expect(html).not.toContain("shuffle-card--loop");
    expect(html).toContain("shuffle-center-symbol");
    expect(html).toContain("☥");
  });

  it("keeps circling when asked to loop", () => {
    const loop = cards(renderToStaticMarkup(<ShuffleOrbit loop />));
    expect(loop).toHaveLength(10);
    loop.forEach(({ classes }) => expect(classes).toContain("shuffle-card--loop"));
  });

  it("hands the one radius to the CSS instead of repeating it", () => {
    [false, true].forEach((loop) =>
      cards(renderToStaticMarkup(<ShuffleOrbit loop={loop} />)).forEach(({ style }) =>
        expect(style).toContain("--orbit-radius:80px")
      )
    );
  });

  it("staggers the cards the same way in both variants, so the loop keeps the chase", () => {
    [false, true].forEach((loop) => {
      const delays = cards(renderToStaticMarkup(<ShuffleOrbit loop={loop} />)).map(({ style }) =>
        Number(style.match(/animation-delay:([\d.]+)s/)?.[1])
      );
      expect(delays.map((d) => Math.round(d * 10))).toEqual(Array.from({ length: 10 }, (_, i) => i));
    });
  });
});

describe("ShuffleAnimation", () => {
  it("still shows the one-shot shuffle with its wording and fade-out wrapper", () => {
    const html = renderToStaticMarkup(<ShuffleAnimation onComplete={() => {}} />);
    expect(html).toContain("shuffle-container");
    expect(cards(html)).toHaveLength(10);
    expect(html).not.toContain("shuffle-card--loop");
    expect(html).toContain("Shuffling the Sacred Deck");
    expect(html).toContain("Focus on your question...");
  });
});

describe("shuffle CSS", () => {
  const css = readFileSync(resolve(__dirname, "../../app/tarot.css"), "utf8");

  it("loops the original shuffle keyframes, not a variant of them", () => {
    expect(css).toMatch(
      /\.shuffle-card--loop\s*{[^}]*shuffleFadeIn 5s ease-in-out infinite[^}]*shuffleCycleFade/
    );
    expect(css).toContain("@keyframes shuffleCycleFade");
  });

  it("stops the cards and the pulse under prefers-reduced-motion", () => {
    const block = css.match(
      /@media \(prefers-reduced-motion: reduce\)\s*{\s*\.shuffle-card,[^{]*{[^}]*}/
    )?.[0];
    expect(block).toBeDefined();
    expect(block).toContain(".shuffle-card--loop");
    expect(block).toContain(".shuffle-center-symbol");
    expect(block).toContain("animation: none");
  });
});
