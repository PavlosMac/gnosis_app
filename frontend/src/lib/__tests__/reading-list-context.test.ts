import { describe, it, expect } from "vitest";
import {
  parseListContext,
  listContextQueryString,
  listHref,
  readingHref,
  isValidIsoDate,
} from "@/lib/reading-list-context";

describe("parseListContext", () => {
  it("returns null when no context params are present", () => {
    expect(parseListContext({})).toBeNull();
    expect(parseListContext({ unrelated: "x" })).toBeNull();
  });

  it("parses page alone", () => {
    expect(parseListContext({ page: "2" })).toEqual({ page: 2 });
  });

  it("defaults page to 1 when filters are present without page", () => {
    expect(parseListContext({ tags: "career,love" })).toEqual({
      page: 1,
      tags: "career,love",
    });
  });

  it("clamps garbage page values to 1", () => {
    expect(parseListContext({ page: "abc" })?.page).toBe(1);
    expect(parseListContext({ page: "0" })?.page).toBe(1);
    expect(parseListContext({ page: "-3" })?.page).toBe(1);
  });

  it("drops an invalid birth_date but keeps the context", () => {
    expect(parseListContext({ birth_date: "not-a-date" })).toEqual({ page: 1 });
    expect(parseListContext({ birth_date: "1990-05-01" })).toEqual({
      page: 1,
      birthDate: "1990-05-01",
    });
  });

  it("takes the first element of array values", () => {
    expect(parseListContext({ page: ["3", "9"], tags: ["a", "b"] })).toEqual({
      page: 3,
      tags: "a",
    });
  });

  it("parses the full set", () => {
    expect(
      parseListContext({
        page: "2",
        spread_type: "Significators",
        tags: "career",
        birth_date: "1990-05-01",
      })
    ).toEqual({
      page: 2,
      spreadType: "Significators",
      tags: "career",
      birthDate: "1990-05-01",
    });
  });
});

describe("listContextQueryString", () => {
  it("always includes page, filters only when set", () => {
    expect(listContextQueryString({ page: 1 })).toBe("page=1");
    expect(
      listContextQueryString({ page: 2, spreadType: "Celtic Cross", tags: "a,b" })
    ).toBe("page=2&spread_type=Celtic+Cross&tags=a%2Cb");
  });

  it("round-trips through parseListContext", () => {
    const ctx = {
      page: 3,
      spreadType: "Significators",
      tags: "career,love",
      birthDate: "1990-05-01",
    };
    const params = Object.fromEntries(
      new URLSearchParams(listContextQueryString(ctx))
    );
    expect(parseListContext(params)).toEqual(ctx);
  });
});

describe("href builders", () => {
  it("builds context-carrying hrefs", () => {
    expect(listHref({ page: 2, tags: "carp" })).toBe(
      "/user/readings?page=2&tags=carp"
    );
    expect(readingHref("abc123", { page: 2, tags: "carp" })).toBe(
      "/user/readings/abc123?page=2&tags=carp"
    );
  });

  it("builds bare hrefs without context", () => {
    expect(listHref(null)).toBe("/user/readings");
    expect(readingHref("abc123", null)).toBe("/user/readings/abc123");
  });
});

describe("isValidIsoDate", () => {
  it("accepts yyyy-mm-dd and rejects everything else", () => {
    expect(isValidIsoDate("1990-05-01")).toBe(true);
    expect(isValidIsoDate("1990-13-45")).toBe(false);
    expect(isValidIsoDate("01/05/1990")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
  });
});
