import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// next/link needs the app router at render time; a plain anchor is enough for markup checks.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));

const { default: TarotLanding } = await import("@/components/TarotLanding");
const { AuthProvider } = await import("@/app/providers/auth-provider");

const html = renderToStaticMarkup(
  <AuthProvider initialUser={null}>
    <TarotLanding />
  </AuthProvider>
);

describe("TarotLanding card grid", () => {
  it("lays the four cards out two by two from md, one column on phones", () => {
    const grid = html.match(/<div class="grid [^"]*"/g) ?? [];
    expect(grid).toHaveLength(1);
    const classes = grid[0]!.split(/\s+/);
    expect(classes).toContain("grid-cols-1");
    expect(classes).toContain("md:grid-cols-2");
    expect(classes).not.toContain("md:grid-cols-3");
  });

  it("links the tool and the three articles in order, ending with the about page", () => {
    const hrefs = ["/significators", "/chart", "/guide", "/about"].map((h) => html.indexOf(`href="${h}"`));
    for (const i of hrefs) expect(i).toBeGreaterThan(-1);
    for (let i = 1; i < hrefs.length; i++) expect(hrefs[i]).toBeGreaterThan(hrefs[i - 1]);
    expect(html.match(/>Article</g) ?? []).toHaveLength(3);
    expect(html).toContain("About Tarot Divinations");
  });
});
