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

const render = (registrationEnabled: boolean) =>
  renderToStaticMarkup(
    <ProfileNavMenu user={null} registrationEnabled={registrationEnabled} onNavigate={() => {}} />
  );

describe("ProfileNavMenu (logged out)", () => {
  it("always offers Login", () => {
    expect(render(false)).toContain('href="/user/login"');
    expect(render(true)).toContain('href="/user/login"');
  });

  it("links to the Guide", () => {
    expect(render(false)).toContain('href="/guide"');
  });

  it("offers Sign up only when registration is enabled", () => {
    expect(render(true)).toContain('href="/user/register"');
    expect(render(true)).toContain("Sign up");
    expect(render(false)).not.toContain("/user/register");
    expect(render(false)).not.toContain("Sign up");
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
      <ProfileNavMenu user={user} registrationEnabled onNavigate={() => {}} />
    );
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain('href="/user/profile"');
    expect(html).toContain('href="/guide"');
    expect(html).not.toContain("/user/register");
  });
});
