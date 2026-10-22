import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));

// The row fetches the document through a server action only when opened
vi.mock("@/app/user/profile/settings/actions", () => ({
  loadAgreementDocument: async () => null,
}));

const { default: AgreementRows } = await import("@/app/user/profile/AgreementRows");

const accepted = { version: "2026-10-04", accepted_at: "2026-10-04T10:12:00Z" };

describe("AgreementRows", () => {
  it("renders a tick, the title as a button and the accepted date", () => {
    const html = renderToStaticMarkup(
      <AgreementRows consents={{ terms: accepted, privacy: accepted }} />
    );
    expect(html).toContain("✓");
    expect(html).toMatch(/<button[^>]*>Terms and Conditions<\/button>/);
    expect(html).toContain("accepted 4 Oct 2026");
    expect(html).not.toContain('href="/legal/');
    // closed until asked: no document text, no dialog
    expect(html).not.toContain('role="dialog"');
  });

  it("keeps the Review / change link to the agreements page", () => {
    const html = renderToStaticMarkup(<AgreementRows consents={undefined} />);
    expect(html).toContain('href="/user/profile/manage-consent"');
    expect(html).toContain("Not yet recorded");
  });
});
