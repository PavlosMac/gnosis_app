import { describe, it, expect } from "vitest";
import {
  formatReadingDate,
  truncateQuestion,
  tagHref,
  agreementRowModel,
  greetingName,
  fullName,
} from "@/lib/profile-dashboard";

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

describe("greetingName", () => {
  it("is the first name, else Seeker", () => {
    expect(greetingName({ firstName: "Ada" })).toBe("Ada");
    expect(greetingName({ firstName: "  " })).toBe("Seeker");
    expect(greetingName({ firstName: null })).toBe("Seeker");
  });
});

describe("fullName", () => {
  it("joins the parts that exist and is null when there are none", () => {
    expect(fullName({ firstName: "Ada", lastName: "Lovelace" })).toBe("Ada Lovelace");
    expect(fullName({ firstName: " Ada ", lastName: null })).toBe("Ada");
    expect(fullName({ firstName: null, lastName: "Lovelace" })).toBe("Lovelace");
    expect(fullName({ firstName: " ", lastName: undefined })).toBeNull();
  });
});
