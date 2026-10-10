import { describe, expect, it } from "vitest";
import { clientIpFrom } from "@/lib/client-ip";

const headers = (values: Record<string, string>) => ({
  get: (name: string) => values[name.toLowerCase()] ?? null,
});

describe("clientIpFrom", () => {
  it("prefers Cloudflare's connecting address", () => {
    expect(
      clientIpFrom(headers({ "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "10.0.0.1" }))
    ).toBe("203.0.113.9");
  });

  it("falls back to the first X-Forwarded-For entry, then X-Real-IP", () => {
    expect(clientIpFrom(headers({ "x-forwarded-for": "198.51.100.7, 10.0.0.1" }))).toBe(
      "198.51.100.7"
    );
    expect(clientIpFrom(headers({ "x-real-ip": "198.51.100.8" }))).toBe("198.51.100.8");
  });

  it("is undefined when no header carries an address", () => {
    expect(clientIpFrom(headers({}))).toBeUndefined();
    expect(clientIpFrom(headers({ "x-forwarded-for": " " }))).toBeUndefined();
  });

  it("rejects values that are not an address, so nothing odd is forwarded", () => {
    expect(clientIpFrom(headers({ "x-forwarded-for": "evil\r\nX-Injected: 1" }))).toBeUndefined();
    expect(clientIpFrom(headers({ "cf-connecting-ip": "2001:db8::1" }))).toBe("2001:db8::1");
  });
});
