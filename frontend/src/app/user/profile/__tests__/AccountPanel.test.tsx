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
  it("labels the chalice Remaining Readings and prints no currency", () => {
    const html = render({ remainingUsd: 1.26, budgetUsd: 3 });
    expect(html).toContain("Remaining Readings");
    expect(html).not.toContain("Oracle Chalice");
    expect(html).not.toContain("$");
    expect(html).not.toContain("remains");
  });

  it("lets the chalice fill and centre the free height, drawn larger", () => {
    const html = render({ remainingUsd: 1.26, budgetUsd: 3 });
    expect(html).toMatch(/class="[^"]*flex-1[^"]*justify-center[^"]*"[^>]*>\s*<span[^>]*>Remaining Readings/);
    expect(html).toContain("max-width:200px");
  });

  it("still says when the chalice runs dry", () => {
    expect(render({ remainingUsd: 0, budgetUsd: 3 })).toContain("The chalice runs dry");
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
