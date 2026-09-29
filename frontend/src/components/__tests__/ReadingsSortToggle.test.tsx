import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ReadingsSortToggle from "@/components/ReadingsSortToggle";
import type { ListContext } from "@/lib/reading-list-context";

const render = (ctx: ListContext) =>
  renderToStaticMarkup(<ReadingsSortToggle ctx={ctx} />).replace(/&amp;/g, "&");

describe("ReadingsSortToggle", () => {
  it("offers the flip to oldest first by default, from page 1", () => {
    const html = render({ page: 3 });
    expect(html).toContain("Newest first");
    expect(html).toContain('href="/user/readings?page=1&sort=created_at&order=asc"');
    expect(html).not.toContain("Relevance");
  });

  it("flips back to the clean default URL from oldest first", () => {
    const html = render({ page: 1, sort: { field: "created_at", order: "asc" }, pageSize: 20 });
    expect(html).toContain("Oldest first");
    expect(html).toContain('href="/user/readings?page=1&page_size=20"');
  });

  it("keeps the active tag filter on the toggle link", () => {
    const html = render({ page: 1, tags: "career" });
    expect(html).not.toContain("Relevance");
    expect(html).toContain('href="/user/readings?page=1&tags=career&sort=created_at&order=asc"');
  });
});
