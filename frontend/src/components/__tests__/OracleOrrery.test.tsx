import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import OracleOrrery, { ORRERY_PHRASES } from "@/components/OracleOrrery";

describe("OracleOrrery", () => {
  const html = renderToStaticMarkup(<OracleOrrery />);

  it("announces itself as a live status region", () => {
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it("opens on the wording the user guide quotes", () => {
    expect(ORRERY_PHRASES[0]).toBe("The Oracle consults the stars...");
    expect(html).toContain("The Oracle consults the stars...");
    expect(html).toContain("A large reading can take a little while.");
  });

  it("puts one body on each of three orbits with distinct radii and periods", () => {
    expect(html.match(/orrery-body/g)?.length).toBe(3);
    const radii = [...html.matchAll(/--orbit-radius:(\d+px)/g)].map((m) => m[1]);
    expect(new Set(radii).size).toBe(3);
    const periods = [...html.matchAll(/--orbit-duration:(\d+s)/g)].map((m) => m[1]);
    expect(new Set(periods).size).toBe(3);
    expect(html).toContain("--orbit-direction:reverse");
  });

  it("rests each body at its own angle so the reduced-motion fallback is not a pile-up", () => {
    const angles = [...html.matchAll(/transform:rotate\((\d+)deg\) translateX/g)].map((m) => m[1]);
    expect(angles).toHaveLength(3);
    expect(new Set(angles).size).toBe(3);
  });

  it("pulses a sun at the centre and scatters a deterministic starfield behind", () => {
    expect(html).toContain("☉");
    expect(html).toContain("animate-orb-pulse");
    expect(html.match(/animate-twinkle/g)?.length).toBe(24);
    expect(renderToStaticMarkup(<OracleOrrery />)).toBe(html);
  });

  it("hides every decorative layer from assistive tech", () => {
    const decorative = html.match(/aria-hidden="true"/g)?.length ?? 0;
    expect(decorative).toBeGreaterThanOrEqual(1);
    // The caption is the only text not inside an aria-hidden layer: the sun glyph must be hidden
    expect(html).toMatch(/<span[^>]*aria-hidden="true"[^>]*>☉</);
  });
});
