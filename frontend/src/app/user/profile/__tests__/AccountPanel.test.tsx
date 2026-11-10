import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// TallyCard's dialog calls a server action; the action module pulls in server-only
// code, so it is replaced (the action has its own test)
vi.mock("@/app/user/profile/actions", () => ({ getMajorArcanaMeaning: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));

const { default: AccountPanel } = await import("@/app/user/profile/AccountPanel");

const render = (birthDate: string | null = "1990-05-01") =>
  renderToStaticMarkup(<AccountPanel name="Ada" birthDate={birthDate} />);

describe("AccountPanel", () => {
  it("shows the first name alone, with no label and no email", () => {
    const html = render();
    expect(html).toMatch(/<p [^>]*title="Ada"[^>]*>Ada<\/p>/);
    expect(html).not.toContain("@");
    expect(html).not.toMatch(/>Name</);
    expect(html).not.toMatch(/>Email</);
  });

  it("renders the empty card-shaped slot on the server, with or without a birth date", () => {
    // TallyCard only draws the card after mount (the user's local date), so the
    // static render is the same empty slot either way: no hydration mismatch
    for (const birthDate of ["1990-05-01", null]) {
      const html = render(birthDate);
      expect(html).toMatch(/data-testid="tally-card-slot"[^>]*class="[^"]*aspect-\[2\/3\][^"]*max-w-\[200px\]/);
      expect(html).toMatch(/<div aria-hidden="true" data-testid="tally-card-slot"[^>]*><\/div>/);
      expect(html).not.toContain("$");
      expect(html).not.toContain("Remaining Readings");
      expect(html).not.toContain("chalice");
      expect(html).not.toContain("ledger");
      expect(html).not.toContain("Card of the Day");
    }
  });

  it("lets the slot centre in the panel's free height", () => {
    expect(render()).toMatch(
      /class="[^"]*flex-1[^"]*justify-center[^"]*"[^>]*>\s*<div aria-hidden="true" data-testid="tally-card-slot"/,
    );
  });

  it("links to Account settings instead of holding the account actions", () => {
    const html = render();
    expect(html).toContain('href="/user/profile/settings"');
    expect(html).toContain("Account settings");
    expect(html).not.toContain("Contact support");
    expect(html).not.toContain("Reset Password");
    expect(html).not.toContain("/user/profile/delete-account");
  });

  it("no longer carries the Agreements block", () => {
    const html = render();
    expect(html).not.toContain("Agreements");
    expect(html).not.toContain("/user/profile/manage-consent");
  });
});
