import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TreeOfLifeDiagram from "@/components/TreeOfLifeDiagram";
import { TREE_PATHS, TREE_VIEWBOX, treeOfLifeNodes } from "@/lib/about-content";

const nodes = treeOfLifeNodes();
const render = (initial?: string) =>
  renderToStaticMarkup(<TreeOfLifeDiagram nodes={nodes} paths={TREE_PATHS} initial={initial} />);

// The <g ...> tag for one sephira, attributes in any order.
const nodeTag = (html: string, name: string): string => {
  const m = html.match(new RegExp(`<g[^>]*data-sephira="${name}"[^>]*>`));
  if (!m) throw new Error(`no node for ${name}`);
  return m[0];
};
const circleAfter = (html: string, name: string): string => {
  const start = html.indexOf(nodeTag(html, name));
  const m = html.slice(start).match(/<circle[^>]*>/);
  if (!m) throw new Error(`no circle for ${name}`);
  return m[0];
};
const cx = (circle: string): number => Number(circle.match(/cx="([\d.]+)"/)![1]);
// Descriptions reach the markup HTML-escaped (Malkuth's has quotes).
const escaped = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

describe("TreeOfLifeDiagram markup", () => {
  it("renders 11 focusable button nodes and 22 paths", () => {
    const html = render();
    const buttons = html.match(/<g[^>]*role="button"[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(11);
    for (const b of buttons) expect(b).toContain('tabindex="0"');
    for (const n of nodes) expect(html).toContain(`data-sephira="${n.name}"`);
    expect(html.match(/<line/g) ?? []).toHaveLength(22);
  });

  it("shows no popup until a sephira is hovered, focused or tapped", () => {
    const html = render();
    expect(html).not.toContain('role="tooltip"');
    expect(html.match(/aria-pressed="true"/g) ?? []).toHaveLength(0);
    expect(nodeTag(html, "Kether")).toContain('aria-label="Kether"');
    expect(html).not.toContain("aria-describedby");
  });

  it("pins a popup for an initial selection, with that sephira's description", () => {
    const html = render("Malkuth");
    expect(nodeTag(html, "Malkuth")).toContain('aria-pressed="true"');
    expect(nodeTag(html, "Kether")).toContain('aria-pressed="false"');
    expect(nodeTag(html, "Kether")).not.toContain("aria-describedby");
    expect(nodeTag(html, "Malkuth")).toContain('aria-describedby="sephira-Malkuth"');
    expect(html).toContain('id="sephira-Malkuth"');
    const popup = html.match(/<div[^>]*role="tooltip"[^>]*>[\s\S]*?<\/div>/g) ?? [];
    expect(popup).toHaveLength(1);
    expect(popup[0]).toContain(">Malkuth<");
    expect(popup[0]).toContain(escaped(nodes.find((n) => n.name === "Malkuth")!.description));
  });

  it("flags the popup as below upper nodes or above lower nodes, and passes the node position as CSS variables", () => {
    const upper = render("Kether").match(/<div[^>]*role="tooltip"[^>]*>/)![0];
    expect(upper).toContain("tree-popup--below");
    expect(upper).not.toContain("tree-popup--above");
    expect(upper).toMatch(/--node-x:\s*50%/);
    expect(upper).toMatch(/--node-y:/);
    const lower = render("Malkuth").match(/<div[^>]*role="tooltip"[^>]*>/)![0];
    expect(lower).toContain("tree-popup--above");
    expect(lower).not.toContain("tree-popup--below");
  });

  it("draws only Daath dashed", () => {
    const html = render();
    for (const n of nodes) {
      const dashed = circleAfter(html, n.name).includes("stroke-dasharray");
      expect(dashed).toBe(n.name === "Daath");
    }
  });

  it("anchors the popup to a positioned wrapper around a viewBox-scaled svg", () => {
    const html = render();
    const root = html.match(/^<div class="([^"]*)"/)![1].split(/\s+/);
    expect(root).toContain("relative");
    expect(html).toContain(`viewBox="${TREE_VIEWBOX}"`);
  });

  it("places the Severity pillar left of centre and Mercy right, as KabbalahLayout does", () => {
    const html = render();
    for (const name of ["Binah", "Geburah", "Hod"]) expect(cx(circleAfter(html, name))).toBeLessThan(150);
    for (const name of ["Chokmah", "Chesed", "Netzach"]) expect(cx(circleAfter(html, name))).toBeGreaterThan(150);
  });
});
