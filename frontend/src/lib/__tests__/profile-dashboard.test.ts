import { describe, it, expect } from "vitest";
import {
  chaliceFill,
  chaliceState,
  chaliceCaption,
  chaliceTitle,
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

describe("chaliceCaption", () => {
  it("says nothing while something remains — no currency on the profile", () => {
    expect(chaliceCaption(2.41)).toBeNull();
  });

  it("marks the dry chalice", () => {
    expect(chaliceCaption(0)).toBe("The chalice runs dry");
    expect(chaliceCaption(-0.1)).toBe("The chalice runs dry");
  });
});

describe("chaliceTitle", () => {
  it("describes the fill level as a percentage for assistive tech", () => {
    expect(chaliceTitle(0.5)).toBe("Remaining readings: the chalice is 50% full");
  });

  it("never says 0% while something remains", () => {
    expect(chaliceTitle(0.004)).toBe("Remaining readings: the chalice is 1% full");
  });

  it("says full wherever the chalice is drawn full", () => {
    expect(chaliceTitle(1)).toBe("Remaining readings: the chalice is full");
    expect(chaliceTitle(0.98)).toBe("Remaining readings: the chalice is full");
    expect(chaliceTitle(0.97)).toBe("Remaining readings: the chalice is 97% full");
  });

  it("names the dry chalice", () => {
    expect(chaliceTitle(0)).toBe("Remaining readings: the chalice runs dry");
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

  it("carries the exact version that was accepted", () => {
    const rows = agreementRowModel({ terms: accepted, privacy: accepted });
    expect(rows).toEqual([
      {
        id: "terms",
        title: "Terms and Conditions",
        accepted: true,
        version: "2026-10-04",
        detail: "accepted 4 Oct 2026",
      },
      {
        id: "privacy",
        title: "Privacy Policy",
        accepted: true,
        version: "2026-10-04",
        detail: "accepted 4 Oct 2026",
      },
    ]);
  });

  it("has no version for a document with no record", () => {
    const [terms, privacy] = agreementRowModel({ privacy: accepted });
    expect(terms).toEqual({
      id: "terms",
      title: "Terms and Conditions",
      accepted: false,
      version: null,
      detail: "Not yet recorded",
    });
    expect(privacy.accepted).toBe(true);
  });

  it("treats absent consents (older backend) as nothing recorded", () => {
    expect(agreementRowModel(undefined).map((r) => r.accepted)).toEqual([false, false]);
  });

  it("drops a malformed stored version", () => {
    const rows = agreementRowModel({ terms: { version: "../x", accepted_at: "nope" } });
    expect(rows[0].version).toBeNull();
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
