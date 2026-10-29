import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));

const { default: AccountPanel } = await import("@/app/user/profile/AccountPanel");

const render = (budget: { remainingUsd: number; budgetUsd: number } | null) =>
  renderToStaticMarkup(
    <AccountPanel name="Seeker" email="s@example.com" budget={budget} />
  );

describe("AccountPanel", () => {
  it("keeps an empty, decorative card-shaped slot where the chalice stood, with no currency", () => {
    for (const budget of [{ remainingUsd: 1.26, budgetUsd: 3 }, { remainingUsd: 0, budgetUsd: 3 }, null]) {
      const html = render(budget);
      expect(html).toMatch(/data-testid="tally-card-slot"[^>]*class="[^"]*aspect-\[2\/3\][^"]*max-w-\[200px\]/);
      expect(html).toMatch(/<div aria-hidden="true" data-testid="tally-card-slot"[^>]*><\/div>/);
      expect(html).not.toContain("$");
      expect(html).not.toContain("Remaining Readings");
      expect(html).not.toContain("chalice");
      expect(html).not.toContain("ledger");
    }
  });

  it("lets the slot centre in the panel's free height", () => {
    expect(render({ remainingUsd: 1, budgetUsd: 3 })).toMatch(
      /class="[^"]*flex-1[^"]*justify-center[^"]*"[^>]*>\s*<div aria-hidden="true" data-testid="tally-card-slot"/,
    );
  });

  it("links to Account settings instead of holding the account actions", () => {
    const html = render({ remainingUsd: 1, budgetUsd: 3 });
    expect(html).toContain('href="/user/profile/settings"');
    expect(html).toContain("Account settings");
    expect(html).not.toContain("Contact support");
    expect(html).not.toContain("Reset Password");
    expect(html).not.toContain("/user/profile/delete-account");
  });

  it("no longer carries the Agreements block", () => {
    const html = render({ remainingUsd: 1, budgetUsd: 3 });
    expect(html).not.toContain("Agreements");
    expect(html).not.toContain("/user/profile/manage-consent");
  });
});
