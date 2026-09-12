import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BudgetChalice, { surfaceYFor } from "@/components/BudgetChalice";

describe("surfaceYFor", () => {
  it("maps the fill fraction onto the bowl interior", () => {
    expect(surfaceYFor(0)).toBe(89);
    expect(surfaceYFor(1)).toBe(32);
    expect(surfaceYFor(0.5)).toBe(60.5);
  });
});

describe("BudgetChalice", () => {
  it("renders the liquid at the level of remaining/budget with an accessible title", () => {
    const html = renderToStaticMarkup(<BudgetChalice remainingUsd={1.5} budgetUsd={3} />);
    expect(html).toContain('transform="translate(0 60.5)"');
    expect(html).toContain("Oracle budget: $1.50 of $3.00 remains");
    expect(html).toContain('role="img"');
    expect(html.match(/chalice-wave/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("chalice-rise");
    expect(html).toContain("chalice-shimmer");
  });

  it("references its own clip path and gradient ids", () => {
    const html = renderToStaticMarkup(<BudgetChalice remainingUsd={2} budgetUsd={3} />);
    const clipId = html.match(/<clipPath id="([^"]+)"/)?.[1];
    expect(clipId).toBeTruthy();
    expect(html).toContain(`clip-path="url(#${clipId})"`);
    expect(clipId).toMatch(/^[a-zA-Z0-9_-]+$/);
  });

  it("renders nothing without a usable budget", () => {
    expect(renderToStaticMarkup(<BudgetChalice remainingUsd={1} budgetUsd={-1} />)).toBe("");
    expect(renderToStaticMarkup(<BudgetChalice remainingUsd={Number.NaN} budgetUsd={3} />)).toBe("");
  });

  it("draws the dry chalice for a $0-capped account", () => {
    const html = renderToStaticMarkup(<BudgetChalice remainingUsd={0} budgetUsd={0} />);
    expect(html).toContain("The chalice runs dry");
    expect(html).toContain('stroke-dasharray="2 3"');
  });

  it("shows a dry chalice with no liquid when nothing remains", () => {
    const html = renderToStaticMarkup(<BudgetChalice remainingUsd={0} budgetUsd={3} />);
    expect(html).toContain("The chalice runs dry");
    expect(html).not.toContain("chalice-wave");
    expect(html).toContain('stroke-dasharray="2 3"');
  });

  it("uses the low-essence palette under a fifth", () => {
    const html = renderToStaticMarkup(<BudgetChalice remainingUsd={0.3} budgetUsd={3} />);
    expect(html).toContain("#c98a2e");
  });
});
