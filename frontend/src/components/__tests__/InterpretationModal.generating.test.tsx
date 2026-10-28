import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// The real modal portals into document.body, which a static render has no access to
vi.mock("@/components/SanctumModal", () => ({
  default: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));
vi.mock("@/app/user/interpret/actions", () => ({
  generateInterpretation: vi.fn(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import InterpretationModal from "@/components/InterpretationModal";

const render = (autoGenerate: boolean) =>
  renderToStaticMarkup(
    <InterpretationModal
      readingId="507f1f77bcf86cd799439011"
      spreadName="Celtic Cross"
      cardVisuals={{}}
      onClose={() => {}}
      onComplete={() => {}}
      autoGenerate={autoGenerate}
    />
  );

describe("InterpretationModal generating state", () => {
  it("shows the looping card shuffle instead of a spinner while the oracle works", () => {
    // autoGenerate opens straight in the generating state (effects do not run here)
    const html = render(true);
    expect(html.match(/shuffle-card--loop/g)?.length).toBe(10);
    expect(html).toContain("The Oracle consults the stars...");
    expect(html).not.toContain("animate-spin");
    expect(html).not.toContain("shuffle-container"); // no 4.5 s fade-out here
  });

  it("does not render the shuffle while waiting for confirmation", () => {
    const html = render(false);
    expect(html).toContain("Consult the Oracle");
    expect(html).not.toContain("shuffle-card");
  });
});
