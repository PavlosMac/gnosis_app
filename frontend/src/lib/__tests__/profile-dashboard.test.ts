import { describe, it, expect } from "vitest";
import {
  chaliceFill,
  chaliceState,
  formatUsd,
  budgetCaption,
  formatReadingDate,
  truncateQuestion,
  tagHref,
  agreementRowModel,
  accountName,
} from "@/lib/profile-dashboard";

describe("chaliceFill", () => {
  it("is the remaining/budget ratio", () => {
    expect(chaliceFill(1.5, 3)).toBe(0.5);
    expect(chaliceFill(3, 3)).toBe(1);
  });

  it("clamps overspend and over-credit into 0..1", () => {
    expect(chaliceFill(-0.2, 3)).toBe(0);
    expect(chaliceFill(4, 3)).toBe(1);
  });

  it("is null when the figures can't yield a level", () => {
    expect(chaliceFill(undefined, 3)).toBeNull();
    expect(chaliceFill(1, undefined)).toBeNull();
    expect(chaliceFill(1, -1)).toBeNull();
    expect(chaliceFill(Number.NaN, 3)).toBeNull();
    expect(chaliceFill(1, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("treats a $0-capped account as a dry chalice, not missing data", () => {
    expect(chaliceFill(0, 0)).toBe(0);
    expect(chaliceFill(1, 0)).toBe(0);
  });
});

describe("chaliceState", () => {
  it("maps thresholds", () => {
    expect(chaliceState(0)).toBe("empty");
    expect(chaliceState(-1)).toBe("empty");
    expect(chaliceState(0.1)).toBe("low");
    expect(chaliceState(0.2)).toBe("partial");
    expect(chaliceState(0.97)).toBe("partial");
    expect(chaliceState(0.98)).toBe("full");
    expect(chaliceState(1)).toBe("full");
  });
});

describe("formatUsd", () => {
  it("prints two decimals with a dollar sign", () => {
    expect(formatUsd(2.41)).toBe("$2.41");
    expect(formatUsd(3)).toBe("$3.00");
    expect(formatUsd(0.005)).toBe("$0.01");
  });

  it("clamps negatives to zero", () => {
    expect(formatUsd(-0.3)).toBe("$0.00");
  });
});

describe("budgetCaption", () => {
  it("states remaining of budget", () => {
    expect(budgetCaption(2.41, 3)).toBe("$2.41 of $3.00 remains");
  });

  it("marks the dry chalice", () => {
    expect(budgetCaption(0, 3)).toBe("The chalice runs dry");
    expect(budgetCaption(-0.1, 3)).toBe("The chalice runs dry");
  });
});

describe("formatReadingDate", () => {
  it("renders en-GB day short-month year", () => {
    // mid-day UTC so no timezone can roll the date
    expect(formatReadingDate("2026-09-10T12:00:00Z")).toMatch(/^10 Sept? 2026$/);
  });
});

describe("truncateQuestion", () => {
  it("passes null and short text through", () => {
    expect(truncateQuestion(null)).toBeNull();
    expect(truncateQuestion("")).toBeNull();
    expect(truncateQuestion("short")).toBe("short");
  });

  it("truncates with an ellipsis past the limit", () => {
    expect(truncateQuestion("abcdef", 5)).toBe("abcde…");
    expect(truncateQuestion("abcde", 5)).toBe("abcde");
  });
});

describe("tagHref", () => {
  it("links to the readings list filtered by that tag on page 1", () => {
    expect(tagHref("career")).toBe("/user/readings?page=1&tags=career");
  });

  it("encodes tags with spaces", () => {
    expect(tagHref("big decision")).toBe("/user/readings?page=1&tags=big+decision");
  });
});

describe("agreementRowModel", () => {
  const accepted = { version: "2026-10-04", accepted_at: "2026-10-04T10:12:00Z" };

  it("links an accepted document to the exact version that was accepted", () => {
    const rows = agreementRowModel({ terms: accepted, privacy: accepted });
    expect(rows).toEqual([
      {
        id: "terms",
        title: "Terms and Conditions",
        accepted: true,
        href: "/legal/terms/2026-10-04",
        detail: "accepted 4 Oct 2026",
      },
      {
        id: "privacy",
        title: "Privacy Policy",
        accepted: true,
        href: "/legal/privacy/2026-10-04",
        detail: "accepted 4 Oct 2026",
      },
    ]);
  });

  it("links a document with no record to its current version", () => {
    const [terms, privacy] = agreementRowModel({ privacy: accepted });
    expect(terms).toEqual({
      id: "terms",
      title: "Terms and Conditions",
      accepted: false,
      href: "/legal/terms",
      detail: "Not yet recorded",
    });
    expect(privacy.accepted).toBe(true);
  });

  it("treats absent consents (older backend) as nothing recorded", () => {
    expect(agreementRowModel(undefined).map((r) => r.accepted)).toEqual([false, false]);
  });

  it("does not turn a malformed stored version into a path", () => {
    const rows = agreementRowModel({ terms: { version: "../x", accepted_at: "nope" } });
    expect(rows[0].href).toBe("/legal/terms");
    expect(rows[0].accepted).toBe(true);
  });
});

describe("accountName", () => {
  it("prefers the display name, then first + last, then Seeker", () => {
    expect(accountName({ displayName: "Ada L", firstName: "Ada", lastName: "Lovelace" })).toBe("Ada L");
    expect(accountName({ displayName: null, firstName: "Ada", lastName: "Lovelace" })).toBe("Ada Lovelace");
    expect(accountName({ displayName: null, firstName: "Ada", lastName: null })).toBe("Ada");
    expect(accountName({ displayName: null, firstName: null, lastName: null })).toBe("Seeker");
  });
});
