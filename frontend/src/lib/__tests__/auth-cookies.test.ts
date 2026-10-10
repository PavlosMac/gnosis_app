import { describe, expect, it } from "vitest";
import {
  applyAuthCookies,
  clearAuthCookies,
  cookieNames,
  readAuthCookies,
} from "@/lib/auth-cookies";

type SetCall = [string, string, Record<string, unknown>];

const recorder = () => {
  const calls: SetCall[] = [];
  return {
    calls,
    set: (name: string, value: string, options: Record<string, unknown>) => {
      calls.push([name, value, options]);
    },
  };
};

const source = (jar: Record<string, string>) => ({
  get: (name: string) => (name in jar ? { value: jar[name] } : undefined),
});

const TOKENS = {
  access_token: "acc",
  refresh_token: "ref",
  token_type: "bearer",
  access_token_expires_at: 1_000_060,
  refresh_token_expires_at: 1_000_600,
};

describe("cookieNames", () => {
  it("uses plain names when not secure", () => {
    expect(cookieNames(false)).toEqual({
      access: "access_token",
      refresh: "refresh_token",
      expiresAt: "token_expires_at",
    });
  });

  it("uses the __Host- prefix when secure", () => {
    expect(cookieNames(true)).toEqual({
      access: "__Host-access_token",
      refresh: "__Host-refresh_token",
      expiresAt: "__Host-token_expires_at",
    });
  });
});

describe("applyAuthCookies", () => {
  it("sets the three cookies with hardened options and maxAge from expiry", () => {
    const target = recorder();
    applyAuthCookies(target, TOKENS, 1_000_000, false);

    const base = { httpOnly: true, sameSite: "lax", path: "/", secure: false };
    expect(target.calls).toEqual([
      ["access_token", "acc", { ...base, maxAge: 60 }],
      ["refresh_token", "ref", { ...base, maxAge: 600 }],
      ["token_expires_at", "1000060", { ...base, maxAge: 60 }],
    ]);
  });

  it("never sets a domain (a __Host- cookie with Domain is rejected)", () => {
    const target = recorder();
    applyAuthCookies(target, TOKENS, 1_000_000, true);
    for (const [name, , options] of target.calls) {
      expect(name.startsWith("__Host-")).toBe(true);
      expect(options).not.toHaveProperty("domain");
      expect(options.secure).toBe(true);
      expect(options.path).toBe("/");
    }
  });

  it("floors maxAge at 0 for already-expired tokens", () => {
    const target = recorder();
    applyAuthCookies(target, TOKENS, 2_000_000, false);
    expect(target.calls.map(([, , o]) => o.maxAge)).toEqual([0, 0, 0]);
  });
});

describe("clearAuthCookies", () => {
  it("clears via set with maxAge 0 and the same options, never delete", () => {
    const target = recorder();
    clearAuthCookies(target, true);

    const opts = { httpOnly: true, sameSite: "lax", path: "/", secure: true, maxAge: 0 };
    expect(target.calls).toEqual([
      ["__Host-access_token", "", opts],
      ["__Host-refresh_token", "", opts],
      ["__Host-token_expires_at", "", opts],
    ]);
  });
});

describe("readAuthCookies", () => {
  it("parses the three cookies", () => {
    const jar = { access_token: "acc", refresh_token: "ref", token_expires_at: "1000060" };
    expect(readAuthCookies(source(jar), false)).toEqual({
      accessToken: "acc",
      refreshToken: "ref",
      expiresAt: 1_000_060,
    });
  });

  it("returns undefined for missing, empty or non-numeric values", () => {
    expect(readAuthCookies(source({}), false)).toEqual({
      accessToken: undefined,
      refreshToken: undefined,
      expiresAt: undefined,
    });
    const jar = { access_token: "", refresh_token: "ref", token_expires_at: "soon" };
    expect(readAuthCookies(source(jar), false)).toEqual({
      accessToken: undefined,
      refreshToken: "ref",
      expiresAt: undefined,
    });
  });

  it("reads the prefixed names when secure", () => {
    const jar = { access_token: "plain", "__Host-access_token": "host" };
    expect(readAuthCookies(source(jar), true).accessToken).toBe("host");
  });
});
