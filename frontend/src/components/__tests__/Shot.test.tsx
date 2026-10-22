import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Shot from "@/components/guide/Shot";

const marks = [
  { x: 10, y: 20, w: 30, h: 15, label: "Choose a spread" },
  { x: 60, y: 80, w: 20, h: 10, label: "Draw the cards" },
];

describe("Shot with an existing image", () => {
  // globe.svg is a real file under public/, standing in for a captured screenshot
  const html = renderToStaticMarkup(
    <Shot src="/globe.svg" w={1280} h={800} alt="Spread picker" marks={marks} />
  );

  it("renders the image with its alt text", () => {
    expect(html).toContain("<img");
    expect(html).toContain('alt="Spread picker"');
  });

  it("draws one ring per mark, positioned in percentages", () => {
    expect(html).toContain("left:10%");
    expect(html).toContain("top:20%");
    expect(html).toContain("width:30%");
    expect(html).toContain("height:15%");
    expect(html).toContain("left:60%");
    expect(html).toContain("border-radius:50%");
  });

  it("draws a rounded rectangle for a mark with shape rect", () => {
    const rect = renderToStaticMarkup(
      <Shot src="/globe.svg" w={100} h={100} alt="x" marks={[{ x: 1, y: 2, w: 3, h: 4, label: "Wide", shape: "rect" }]} />
    );
    expect(rect).toContain("width:3%;height:4%;border-radius:12px");
    // an ellipse mark on the same page keeps the circular ring
    const ellipse = renderToStaticMarkup(
      <Shot src="/globe.svg" w={100} h={100} alt="x" marks={[{ x: 1, y: 2, w: 3, h: 4, label: "Round" }]} />
    );
    expect(ellipse).toContain("width:3%;height:4%;border-radius:50%");
  });

  it("caps the display width and centres the figure when maxWidth is given", () => {
    const narrow = renderToStaticMarkup(
      <Shot src="/globe.svg" w={100} h={100} alt="x" maxWidth={420} marks={[{ x: 1, y: 2, w: 3, h: 4, label: "A" }]} />
    );
    expect(narrow).toContain("max-width:420px");
    expect(narrow).toContain("margin:1.5rem auto");
    // without it the figure fills the panel and has no max-width
    expect(renderToStaticMarkup(<Shot src="/globe.svg" w={100} h={100} alt="x" />)).not.toContain("max-width");
  });

  it("numbers the rings and repeats the labels in a legend list", () => {
    expect(html.match(/<li/g) ?? []).toHaveLength(2);
    expect(html).toContain("Choose a spread");
    expect(html).toContain("Draw the cards");
    expect(html).toContain(">1<");
    expect(html).toContain(">2<");
  });

  it("does not show the pending placeholder", () => {
    expect(html).not.toContain("Screenshot pending");
  });
});

describe("Shot with a missing image", () => {
  const html = renderToStaticMarkup(
    <Shot src="/guide/does-not-exist/01-nothing.png" w={1280} h={800} alt="Missing" marks={marks} />
  );

  it("shows a pending placeholder instead of a broken image", () => {
    expect(html).not.toContain("<img");
    expect(html).toContain("Screenshot pending");
    expect(html).toContain("Missing");
  });

  it("still lists the legend so the chapter stays readable", () => {
    expect(html.match(/<li/g) ?? []).toHaveLength(2);
    expect(html).toContain("Choose a spread");
  });
});
