import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// The logout server action pulls in next/headers; the nav only needs a form action reference.
vi.mock("@/app/user/logout/actions", () => ({ logout: async () => {} }));
// next/link needs the app router at render time; a plain anchor is enough for markup checks.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));

const { default: ProfileNav } = await import("@/components/ProfileNav");
const { AuthProvider } = await import("@/app/providers/auth-provider");

const render = () =>
  renderToStaticMarkup(
    <AuthProvider initialUser={null}>
      <ProfileNav />
    </AuthProvider>
  );

const rootClasses = (html: string): string[] => {
  const m = html.match(/^<div class="([^"]*)"/);
  if (!m) throw new Error(`no root div in ${html}`);
  return m[1].split(/\s+/);
};

// Tailwind's default breakpoint widths (px) — the only ones this codebase uses.
const TAILWIND_BREAKPOINTS: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280 };

const src = (relPath: string) =>
  readFileSync(path.resolve(__dirname, "../../", relPath), "utf8");

describe("ProfileNav placement", () => {
  it("scrolls with the page on phones so it never sits over a full-width card grid, and pins on wider screens", () => {
    const classes = rootClasses(render());
    // Phone: in document flow at the top-right, like the page's Portal link, so the
    // 78-card grid (which spans the viewport width there) scrolls out from under it.
    expect(classes).toContain("absolute");
    expect(classes).not.toContain("fixed");
    // Tablet and up, once the grid actually has side margins, the nav can stay pinned.
    expect(classes.some((c) => /^\w+:fixed$/.test(c))).toBe(true);
  });

  it("only pins at a breakpoint where the deck grid has grown side margins wide enough to clear the button", () => {
    // Deck grid: mx-auto with a capped width inside the page's own side padding
    // (FaceUpDeck.tsx / ShuffledDeck.tsx share this class; reading/page.tsx supplies the padding).
    const deckSrc = src("components/FaceUpDeck.tsx");
    const deckMatch = deckSrc.match(/max-w-\[(\d+)px\] sm:max-w-\[(\d+)px\]/);
    if (!deckMatch) throw new Error("could not find deck grid max-width classes in FaceUpDeck.tsx");
    const deckMaxWidth = Number(deckMatch[2]);

    const pageSrc = src("app/reading/page.tsx");
    const paddingMatch = pageSrc.match(/px-1 sm:px-(\d+)/);
    if (!paddingMatch) throw new Error("could not find page side-padding class in reading/page.tsx");
    const pagePaddingPx = Number(paddingMatch[1]) * 4; // Tailwind spacing scale: px-N = N * 4px

    // Button footprint: top-4/right-4 offset plus its own width (w-10).
    const navSrc = src("components/ProfileNav.tsx");
    const offsetMatch = navSrc.match(/\bright-(\d+)\b/);
    const widthMatch = navSrc.match(/\bw-(\d+)\b/);
    if (!offsetMatch || !widthMatch) throw new Error("could not find button offset/width classes in ProfileNav.tsx");
    const buttonFootprintPx = Number(offsetMatch[1]) * 4 + Number(widthMatch[1]) * 4;

    // Smallest viewport width at which centering margin >= buttonFootprintPx:
    //   margin(W) = pagePadding + (W - 2*pagePadding - deckMaxWidth) / 2
    const safeWidth =
      2 * pagePaddingPx + deckMaxWidth + 2 * (buttonFootprintPx - pagePaddingPx);

    const breakpointMatch = navSrc.match(/\b(\w+):fixed\b/);
    if (!breakpointMatch) throw new Error("could not find the sm:/md:/lg:fixed class in ProfileNav.tsx");
    const chosenBreakpoint = TAILWIND_BREAKPOINTS[breakpointMatch[1]];
    if (!chosenBreakpoint) throw new Error(`unknown breakpoint prefix "${breakpointMatch[1]}"`);

    expect(chosenBreakpoint).toBeGreaterThanOrEqual(safeWidth);
  });
});
