import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { GUIDE_CHAPTERS, getChapter, adjacentChapters } from "@/lib/guide-chapters";

const CONTENT_DIR = path.resolve(__dirname, "../../content/guide");

describe("GUIDE_CHAPTERS", () => {
  it("has unique, kebab-case slugs", () => {
    const slugs = GUIDE_CHAPTERS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("has an MDX file for every chapter and a chapter for every MDX file", () => {
    const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".mdx")).map((f) => f.replace(/\.mdx$/, ""));
    expect(files.sort()).toEqual(GUIDE_CHAPTERS.map((c) => c.slug).sort());
  });

  it("registers every chapter in the static MDX map", () => {
    const source = fs.readFileSync(path.join(CONTENT_DIR, "index.ts"), "utf8");
    for (const { slug } of GUIDE_CHAPTERS) expect(source).toContain(`"${slug}"`);
  });

  it("gives every chapter a title, summary and symbol", () => {
    for (const c of GUIDE_CHAPTERS) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.summary.length).toBeGreaterThan(0);
      expect(c.symbol.length).toBeGreaterThan(0);
    }
  });
});

describe("getChapter", () => {
  it("finds a chapter by slug and returns undefined otherwise", () => {
    expect(getChapter(GUIDE_CHAPTERS[0].slug)).toBe(GUIDE_CHAPTERS[0]);
    expect(getChapter("nope")).toBeUndefined();
  });
});

describe("adjacentChapters", () => {
  it("has no prev for the first chapter and no next for the last", () => {
    const first = adjacentChapters(GUIDE_CHAPTERS[0].slug);
    expect(first.prev).toBeNull();
    expect(first.next).toBe(GUIDE_CHAPTERS[1]);
    const last = adjacentChapters(GUIDE_CHAPTERS[GUIDE_CHAPTERS.length - 1].slug);
    expect(last.next).toBeNull();
    expect(last.prev).toBe(GUIDE_CHAPTERS[GUIDE_CHAPTERS.length - 2]);
  });

  it("returns both neighbours for a middle chapter", () => {
    const { prev, next } = adjacentChapters(GUIDE_CHAPTERS[2].slug);
    expect(prev).toBe(GUIDE_CHAPTERS[1]);
    expect(next).toBe(GUIDE_CHAPTERS[3]);
  });

  it("returns nulls for an unknown slug", () => {
    expect(adjacentChapters("nope")).toEqual({ prev: null, next: null });
  });
});
