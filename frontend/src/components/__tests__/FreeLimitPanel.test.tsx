import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// The real modal portals into document.body, which the static renderer cannot do
vi.mock("@/components/SanctumModal", () => ({
  default: ({ title, children }: { title: string; children: React.ReactNode }) =>
    React.createElement("section", null, React.createElement("h2", null, title), children),
}));
// AuthPageShell drags in TarotPageLayout and its stylesheet, which the panel never renders
vi.mock("@/components/TarotPageLayout", () => ({ default: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));

const auth = { registrationEnabled: true };
vi.mock("@/app/providers/auth-provider", () => ({ useAuth: () => auth }));

import FreeLimitPanel from "@/components/FreeLimitPanel";

const render = (variant: "reading" | "significators") =>
  renderToStaticMarkup(
    <FreeLimitPanel variant={variant} onClose={() => {}} onLogin={() => {}} />
  );

describe("FreeLimitPanel", () => {
  beforeEach(() => {
    auth.registrationEnabled = true;
  });

  it("invites a visitor to register after the free readings, with login as the second path", () => {
    const html = render("reading");
    expect(html).toContain("The Oracle Awaits");
    expect(html).toContain("keep reading");
    expect(html).not.toContain("You have drawn");
    expect(html).toContain('href="/user/register"');
    expect(html).toContain("Begin your journey");
    expect(html).toContain("Enter the Sanctum");
  });

  it("speaks of significators on the significators variant", () => {
    const html = render("significators");
    expect(html).toContain("birth dates");
    expect(html).not.toContain("keep reading");
    expect(html).not.toContain("You have cast");
    expect(html).toContain('href="/user/register"');
  });

  it("lists what an account offers and links to the about page", () => {
    const html = render("reading");
    expect(html).toContain("What you get");
    expect(html).toContain("A Readings Journal with tags and filtering");
    expect(html).toContain('href="/about"');
  });

  it("offers only login when registration is closed", () => {
    auth.registrationEnabled = false;
    const html = render("reading");
    expect(html).not.toContain("/user/register");
    expect(html).not.toContain("Begin your journey");
    expect(html).toContain("Enter the Sanctum");
  });
});
