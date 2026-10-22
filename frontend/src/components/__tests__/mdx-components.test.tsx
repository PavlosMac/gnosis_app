import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href, "data-next-link": "", ...rest }, children),
}));

const { useMDXComponents } = await import("@/mdx-components");
const { guideComponents } = await import("@/components/guide/guide-components");

const link = (href: string) => {
  const A = useMDXComponents().a as React.FC<{ href: string; children: string }>;
  return renderToStaticMarkup(<A href={href}>text</A>);
};

describe("shared MDX link", () => {
  it("routes in-site paths through next/link", () => {
    expect(link("/guide/reading-the-cards")).toContain("data-next-link");
    expect(link("/significators")).not.toContain("target=");
  });

  it("keeps external links as plain anchors opening a new tab", () => {
    const html = link("https://example.com");
    expect(html).not.toContain("data-next-link");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("keeps protocol-relative, mailto and anchor links as plain anchors", () => {
    for (const href of ["//example.com", "mailto:a@b.c", "#top"]) {
      expect(link(href)).not.toContain("data-next-link");
    }
  });
});

describe("MDX component maps", () => {
  it("keeps the guide-only elements out of the shared map the legal documents use", () => {
    const shared = useMDXComponents();
    for (const key of ["h3", "blockquote", "Gold", "Callout", "Shot"]) {
      expect(shared).not.toHaveProperty(key);
      expect(guideComponents).toHaveProperty(key);
    }
  });
});
