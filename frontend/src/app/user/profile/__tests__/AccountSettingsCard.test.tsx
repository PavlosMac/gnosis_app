import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Server actions pull in next/headers; the card only needs action references
vi.mock("@/app/user/profile/actions", () => ({
  requestPasswordResetForCurrentUser: async () => ({ success: false }),
  contactSupport: async () => ({ success: false }),
}));
// The support modal's import chain reaches TarotPageLayout, which loads Google fonts at module scope
vi.mock("@/app/user/profile/settings/actions", () => ({
  loadAgreementDocument: async () => null,
}));
vi.mock("next/font/google", () => ({
  Cinzel: () => ({ className: "" }),
  Crimson_Pro: () => ({ className: "" }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));

const { default: AccountSettingsCard } = await import(
  "@/app/user/profile/settings/AccountSettingsCard"
);

describe("AccountSettingsCard", () => {
  const html = renderToStaticMarkup(
    <AccountSettingsCard consents={undefined} />
  );

  it("offers contact support", () => {
    expect(html).toContain("Contact support");
  });

  it("shows the Agreements block below Contact support", () => {
    expect(html).toContain("Agreements");
    expect(html).toContain('href="/user/profile/manage-consent"');
    expect(html.indexOf("Contact support")).toBeLessThan(html.indexOf("Agreements"));
  });

  it("opens each agreement in a modal rather than leaving the page", () => {
    expect(html).toMatch(/<button[^>]*>Terms and Conditions<\/button>/);
    expect(html).toMatch(/<button[^>]*>Privacy Policy<\/button>/);
    expect(html).not.toContain('href="/legal/');
    // closed until asked
    expect(html).not.toContain('role="dialog"');
  });

  it("offers the one-click password reset", () => {
    expect(html).toContain("Reset Password");
  });

  it("links to account deletion in the danger zone", () => {
    expect(html).toContain('href="/user/profile/delete-account"');
    expect(html).toContain("Delete account");
  });
});
