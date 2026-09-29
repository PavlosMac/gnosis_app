import { describe, it, expect } from "vitest";
import {
  parseListContext,
  listContextQueryString,
  listHref,
  readingHref,
  pageSizeOf,
  clampPage,
  MAX_PAGE,
  dateSort,
  dateToggleTarget,
  READINGS_PAGE_SIZE,
  isValidIsoDate,
  sanitizePageSize,
  readingsViewState,
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

describe("parseListContext view settings", () => {
  it("reads a whitelisted sort field with its order, defaulting to desc", () => {
    expect(parseListContext({ sort: "created_at", order: "asc" })).toEqual({
      page: 1,
      sort: { field: "created_at", order: "asc" },
    });
    expect(parseListContext({ sort: "created_at" })).toEqual({
      page: 1,
      sort: { field: "created_at", order: "desc" },
    });
    expect(parseListContext({ sort: "created_at", order: "sideways" })).toEqual({
      page: 1,
      sort: { field: "created_at", order: "desc" },
    });
  });

  it("drops an unknown sort field, and an order without a field", () => {
    expect(parseListContext({ sort: "password_hash", order: "asc" })).toEqual({ page: 1 });
    expect(parseListContext({ order: "asc" })).toBeNull();
  });

  it("reads a page size only when it is one of the offered options", () => {
    expect(parseListContext({ page_size: "20" })).toEqual({ page: 1, pageSize: 20 });
    expect(parseListContext({ page_size: "50" })).toEqual({ page: 1, pageSize: 50 });
    expect(parseListContext({ page_size: "37" })).toEqual({ page: 1 });
    expect(parseListContext({ page_size: "abc" })).toEqual({ page: 1 });
  });

  it("omits the default page size so default URLs stay canonical", () => {
    expect(parseListContext({ page_size: String(READINGS_PAGE_SIZE) })).toEqual({
      page: 1,
    });
  });

  it("treats a lone sort or page size as list context", () => {
    expect(parseListContext({ sort: "created_at" })).not.toBeNull();
    expect(parseListContext({ page_size: "20" })).not.toBeNull();
  });
});

describe("dateSort", () => {
  it("spells out oldest first and folds newest first into the default", () => {
    expect(dateSort("asc")).toEqual({ field: "created_at", order: "asc" });
    expect(dateSort("desc")).toBeUndefined();
  });
});

describe("dateToggleTarget", () => {
  const oldest = { field: "created_at", order: "asc" } as const;

  it("flips between newest and oldest, keeping the default URL clean", () => {
    expect(dateToggleTarget(undefined)).toEqual(oldest);
    expect(dateToggleTarget(oldest)).toBeUndefined();
    expect(dateToggleTarget({ field: "created_at", order: "desc" })).toEqual(oldest);
  });
});

describe("clampPage", () => {
  it("keeps page within what the backend accepts", () => {
    expect(clampPage(3)).toBe(3);
    expect(clampPage(MAX_PAGE)).toBe(MAX_PAGE);
    expect(clampPage(MAX_PAGE + 1)).toBe(MAX_PAGE);
    expect(clampPage(1e21)).toBe(MAX_PAGE);
    expect(clampPage(0)).toBe(1);
    expect(clampPage(-3)).toBe(1);
    expect(clampPage(2.7)).toBe(2);
    expect(clampPage(NaN)).toBe(1);
    expect(clampPage(Infinity)).toBe(1);
  });

  it("is applied when parsing the URL", () => {
    expect(parseListContext({ page: "99999999999999999999" })?.page).toBe(MAX_PAGE);
  });
});

describe("pageSizeOf", () => {
  it("falls back to the default page size", () => {
    expect(pageSizeOf({ page: 1 })).toBe(READINGS_PAGE_SIZE);
    expect(pageSizeOf(null)).toBe(READINGS_PAGE_SIZE);
    expect(pageSizeOf({ page: 1, pageSize: 50 })).toBe(50);
  });
});

describe("listContextQueryString", () => {
  it("always includes page, filters only when set", () => {
    expect(listContextQueryString({ page: 1 })).toBe("page=1");
    expect(
      listContextQueryString({ page: 2, spreadType: "Celtic Cross", tags: "a,b" })
    ).toBe("page=2&spread_type=Celtic+Cross&tags=a%2Cb");
  });

  it("emits sort and page size only when set", () => {
    expect(
      listContextQueryString({
        page: 1,
        sort: { field: "created_at", order: "asc" },
        pageSize: 20,
      })
    ).toBe("page=1&sort=created_at&order=asc&page_size=20");
  });

  it("leaves the default desc order out of the URL", () => {
    expect(
      listContextQueryString({ page: 1, sort: { field: "created_at", order: "desc" } })
    ).toBe("page=1&sort=created_at");
  });

  it("round-trips through parseListContext", () => {
    const ctx = {
      page: 3,
      spreadType: "Significators",
      tags: "career,love",
      birthDate: "1990-05-01",
      sort: { field: "created_at" as const, order: "asc" as const },
      pageSize: 20,
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

  it("carries sort and page size onto the reading href", () => {
    expect(
      readingHref("abc123", {
        page: 2,
        sort: { field: "created_at", order: "asc" },
        pageSize: 50,
      })
    ).toBe("/user/readings/abc123?page=2&sort=created_at&order=asc&page_size=50");
  });

  it("builds bare hrefs without context", () => {
    expect(listHref(null)).toBe("/user/readings");
    expect(readingHref("abc123", null)).toBe("/user/readings/abc123");
  });
});

describe("sanitizePageSize", () => {
  it("passes through an offered page size", () => {
    expect(sanitizePageSize(10)).toBe(10);
    expect(sanitizePageSize(20)).toBe(20);
    expect(sanitizePageSize(50)).toBe(50);
  });

  it("falls back to the default for anything off the whitelist", () => {
    expect(sanitizePageSize(33)).toBe(READINGS_PAGE_SIZE);
    expect(sanitizePageSize(0)).toBe(READINGS_PAGE_SIZE);
    expect(sanitizePageSize(-5)).toBe(READINGS_PAGE_SIZE);
    expect(sanitizePageSize(51)).toBe(READINGS_PAGE_SIZE);
    expect(sanitizePageSize(NaN)).toBe(READINGS_PAGE_SIZE);
    expect(sanitizePageSize(Infinity)).toBe(READINGS_PAGE_SIZE);
  });

  it("floors before checking the whitelist", () => {
    expect(sanitizePageSize(20.9)).toBe(20);
    expect(sanitizePageSize(9.9)).toBe(READINGS_PAGE_SIZE);
  });
});

describe("readingsViewState", () => {
  it("is 'empty' when the archive has nothing at all", () => {
    expect(readingsViewState(0, 0)).toBe("empty");
  });

  it("is 'no-matches-on-page' when items are missing but matches exist elsewhere", () => {
    expect(readingsViewState(0, 25)).toBe("no-matches-on-page");
  });

  it("is 'results' whenever items came back", () => {
    expect(readingsViewState(1, 1)).toBe("results");
    expect(readingsViewState(20, 25)).toBe("results");
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
