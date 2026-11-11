import { describe, it, expect } from "vitest";
import { isSafeReturnPath, loginHrefFor } from "@/lib/auth-return-path";

const ORIGIN = "https://tarotdivinations.com";

describe("isSafeReturnPath", () => {
  it("accepts same-origin absolute paths", () => {
    for (const good of [
      "/",
      "/user/profile",
      "/user/readings/6a991d61c00f6ed3f7412044",
      "/user/readings?sort=newest&tag=love",
      "/user/profile#settings",
      "/guide/saving-a-reading",
    ]) {
      expect(isSafeReturnPath(good), good).toBe(true);
      // The browser must land on our origin for every accepted value.
      expect(new URL(good, ORIGIN).origin).toBe(ORIGIN);
    }
  });

  it("rejects values the WHATWG URL parser resolves off-origin", () => {
    for (const bad of [
      "//evil.com",
      "//evil.com/user/profile",
      "/\\evil.com", // backslash is a slash in special schemes: resolves to https://evil.com/
      "/\\\\evil.com",
      "/\t\\evil.com", // tabs and newlines are stripped before parsing
      "/\n/evil.com",
      "\\\\evil.com",
      "/\\/evil.com",
    ]) {
      expect(isSafeReturnPath(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it("rejects absolute URLs, schemes and non-paths", () => {
    for (const bad of [
      "https://evil.com",
      "http://tarotdivinations.com/user/profile", // absolute even when it is us
      "javascript:alert(1)",
      "data:text/html,hi",
      "user/profile",
      "?from=/user/profile",
      "",
      " /user/profile",
    ]) {
      expect(isSafeReturnPath(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it("rejects non-strings", () => {
    for (const bad of [undefined, null, 42, ["/user/profile"], { from: "/user/profile" }]) {
      expect(isSafeReturnPath(bad)).toBe(false);
    }
  });

  it("accepts every path loginHrefFor produces, round-tripped through the query string", () => {
    for (const path of ["/user/profile", "/user/readings/abc?x=1&y=2", "/reading#top"]) {
      const href = loginHrefFor(path);
      const from = new URL(href, ORIGIN).searchParams.get("from");
      expect(from).toBe(path);
      expect(isSafeReturnPath(from)).toBe(true);
    }
  });
});
