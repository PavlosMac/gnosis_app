import { describe, it, expect } from "vitest";
import type { TagSummary } from "@/types/reading";
import {
  filterTagSuggestions,
  parseTagsParam,
  serializeTags,
  MAX_TAG_SUGGESTIONS,
} from "@/lib/tag-suggestions";

// Most-used first, as the backend returns them
const vocabulary: TagSummary[] = [
  { name: "career", count: 5 },
  { name: "love", count: 3 },
  { name: "big-decision", count: 2 },
  { name: "family", count: 2 },
  { name: "travel", count: 1 },
];

const names = (tags: TagSummary[]) => tags.map((t) => t.name);

describe("filterTagSuggestions", () => {
  it("returns nothing for an empty vocabulary", () => {
    expect(filterTagSuggestions([], [], "")).toEqual([]);
    expect(filterTagSuggestions([], [], "career")).toEqual([]);
  });

  it("suggests nothing until the query is at least 2 characters", () => {
    expect(filterTagSuggestions(vocabulary, [], "")).toEqual([]);
    expect(filterTagSuggestions(vocabulary, [], "c")).toEqual([]);
    expect(filterTagSuggestions(vocabulary, [], "   ")).toEqual([]);
    expect(filterTagSuggestions(vocabulary, [], " c ")).toEqual([]);
    expect(names(filterTagSuggestions(vocabulary, [], "ca"))).toEqual(["career"]);
  });

  it("excludes already-selected tags, case-insensitively", () => {
    const withCareers = [...vocabulary, { name: "career-change", count: 1 }];
    expect(names(filterTagSuggestions(withCareers, ["career"], "ca"))).toEqual([
      "career-change",
    ]);
    expect(names(filterTagSuggestions(vocabulary, ["FAMILY"], "fa"))).toEqual([]);
  });

  it("ranks prefix matches before other substring matches, keeping given order within groups", () => {
    const withVision = [...vocabulary, { name: "decisions", count: 1 }];
    // "deci": prefix match "decisions", substring match "big-decision"
    expect(names(filterTagSuggestions(withVision, [], "deci"))).toEqual([
      "decisions",
      "big-decision",
    ]);
  });

  it("matches case-insensitively in both directions", () => {
    expect(names(filterTagSuggestions(vocabulary, [], "CAR"))).toEqual(["career"]);
    expect(names(filterTagSuggestions([{ name: "Career", count: 1 }], [], "car"))).toEqual([
      "Career",
    ]);
  });

  it("still suggests an exact match of the query", () => {
    expect(names(filterTagSuggestions(vocabulary, [], "love"))).toEqual(["love"]);
  });

  it("returns nothing when no tag matches", () => {
    expect(filterTagSuggestions(vocabulary, [], "zzz")).toEqual([]);
  });

  it("caps results at the given max", () => {
    const many = [...Array(20)].map((_, i) => ({ name: `tag-${i}`, count: 1 }));
    expect(filterTagSuggestions(many, [], "tag")).toHaveLength(MAX_TAG_SUGGESTIONS);
    expect(filterTagSuggestions(many, [], "tag", 3)).toHaveLength(3);
  });

  it("dedupes the vocabulary defensively", () => {
    const dupes = [
      { name: "career", count: 2 },
      { name: "Career", count: 1 },
    ];
    expect(names(filterTagSuggestions(dupes, [], "ca"))).toEqual(["career"]);
  });
});

describe("parseTagsParam", () => {
  it("returns an empty list for undefined or empty input", () => {
    expect(parseTagsParam(undefined)).toEqual([]);
    expect(parseTagsParam("")).toEqual([]);
  });

  it("splits, trims, lowercases, dedupes, and drops empties", () => {
    expect(parseTagsParam("a, b,,B ")).toEqual(["a", "b"]);
  });

  it("round-trips through serializeTags", () => {
    const tags = parseTagsParam("career,love,big-decision");
    expect(parseTagsParam(serializeTags(tags))).toEqual(tags);
  });
});

describe("serializeTags", () => {
  it("joins tags with commas", () => {
    expect(serializeTags(["career", "love"])).toBe("career,love");
    expect(serializeTags([])).toBe("");
  });
});
