import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// The logout server action pulls in next/headers; the menu only needs a form action reference.
vi.mock("@/app/user/logout/actions", () => ({ logout: async () => {} }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));

const { ProfileNavMenu } = await import("@/components/ProfileNav");

const render = () =>
  renderToStaticMarkup(<ProfileNavMenu user={null} onNavigate={() => {}} />);

describe("ProfileNavMenu (logged out)", () => {
  it("offers Login", () => {
    expect(render()).toContain('href="/user/login"');
  });

  it("offers nothing else: no Sign up (the login page links to it) and no Guide (signed-in menu only)", () => {
    const html = render();
    expect(html).not.toContain("/user/register");
    expect(html).not.toContain("Sign up");
    expect(html).not.toContain("/guide");
    expect(html.match(/<a /g) ?? []).toHaveLength(1);
  });
});

describe("ProfileNavMenu (logged in)", () => {
  it("shows the account links and never Sign up", () => {
    const user = {
      id: "1",
      email: "ada@example.com",
      displayName: "Ada Lovelace",
      firstName: "Ada",
      lastName: "Lovelace",
      status: "active" as const,
      emailVerifiedAt: null,
      credits: 0,
      isSuperadmin: false,
      createdAt: "",
      updatedAt: "",
    };
    const html = renderToStaticMarkup(
      <ProfileNavMenu user={user} onNavigate={() => {}} />
    );
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain('href="/user/profile"');
    expect(html).toContain('href="/guide"');
    expect(html).not.toContain("/user/register");
  });
});

describe("ProfileNavMenu (superadmin)", () => {
  const base = {
    id: "1",
    email: "ada@example.com",
    displayName: "Ada Lovelace",
    firstName: "Ada",
    lastName: "Lovelace",
    status: "active" as const,
    emailVerifiedAt: null,
    credits: 0,
    createdAt: "",
    updatedAt: "",
  };
  const renderFor = (isSuperadmin: boolean) =>
    renderToStaticMarkup(
      <ProfileNavMenu user={{ ...base, isSuperadmin }} onNavigate={() => {}} />
    );

  it("shows the Superadmin link to the superadmin only", () => {
    expect(renderFor(true)).toContain('href="/superadmin"');
    expect(renderFor(false)).not.toContain("/superadmin");
  });
});
