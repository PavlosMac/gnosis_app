import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));

const { default: ReadingsPanel } = await import("@/app/user/profile/ReadingsPanel");

const html = renderToStaticMarkup(
  <ReadingsPanel summary={{ total: 7, lastReading: null, tags: [] }} />
);

describe("ReadingsPanel", () => {
  it("shows the bare count with no caption", () => {
    expect(html).toMatch(/>7<\/div>/);
    expect(html).not.toContain("sr-only");
    expect(html).not.toContain("readings saved");
  });

  it("keeps each action label on one line", () => {
    expect(html.match(/whitespace-nowrap/g)).toHaveLength(2);
  });

  it("labels the two actions with visible text instead of a tooltip", () => {
    expect(html).toMatch(/<a href="\/reading"[^>]*>.*New reading.*<\/a>/);
    expect(html).toMatch(/<a href="\/user\/readings[^"]*"[^>]*>.*Past readings.*<\/a>/);
    expect(html).not.toContain("sanctum-tip");
  });

  it("puts past readings before new reading", () => {
    const past = html.indexOf('href="/user/readings');
    const fresh = html.indexOf('href="/reading"');
    expect(past).toBeGreaterThan(-1);
    expect(fresh).toBeGreaterThan(-1);
    expect(past).toBeLessThan(fresh);
  });
});
