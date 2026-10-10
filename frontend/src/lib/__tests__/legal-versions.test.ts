import { afterEach, describe, expect, it } from "vitest";
import {
  formatVersionDate,
  isLegalDocumentId,
  isVersionString,
  newestVersion,
  sortVersions,
  versionFromFilename,
} from "@/lib/legal-versions";

describe("isLegalDocumentId", () => {
  it("accepts the two documents and nothing else", () => {
    expect(isLegalDocumentId("terms")).toBe(true);
    expect(isLegalDocumentId("privacy")).toBe(true);
    expect(isLegalDocumentId("gdpr")).toBe(false);
    expect(isLegalDocumentId("../terms")).toBe(false);
    expect(isLegalDocumentId(undefined)).toBe(false);
  });
});

describe("isVersionString", () => {
  it("accepts ISO dates only", () => {
    expect(isVersionString("2026-10-04")).toBe(true);
    expect(isVersionString("2026-9-1")).toBe(false);
    expect(isVersionString("terms")).toBe(false);
    expect(isVersionString("2026-10-04.mdx")).toBe(false);
    expect(isVersionString("../2026-10-04")).toBe(false);
    expect(isVersionString(null)).toBe(false);
  });
});

describe("versionFromFilename", () => {
  it("strips .mdx from a dated file", () => {
    expect(versionFromFilename("2026-10-04.mdx")).toBe("2026-10-04");
  });

  it("rejects stray files so they can never become the current version", () => {
    expect(versionFromFilename("terms.mdx")).toBeNull();
    expect(versionFromFilename("2026-9-1.mdx")).toBeNull();
    expect(versionFromFilename("2026-10-04.md")).toBeNull();
    expect(versionFromFilename("README.md")).toBeNull();
  });
});

describe("newestVersion / sortVersions", () => {
  it("sorts ascending and picks the lexicographically last date", () => {
    const list = ["2026-11-01", "2026-09-30", "2027-01-15"];
    expect(sortVersions(list)).toEqual(["2026-09-30", "2026-11-01", "2027-01-15"]);
    expect(newestVersion(list)).toBe("2027-01-15");
    expect(list).toEqual(["2026-11-01", "2026-09-30", "2027-01-15"]); // not mutated
  });

  it("is undefined for an empty list", () => {
    expect(newestVersion([])).toBeUndefined();
  });
});

describe("formatVersionDate", () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("formats a version as a calendar date", () => {
    expect(formatVersionDate("2026-10-04")).toBe("4 Oct 2026");
  });

  it("does not shift a day behind on a negative-UTC-offset server", () => {
    // A version parses as UTC midnight; without forcing UTC on render, a
    // negative-offset zone would print it as the previous evening/day.
    process.env.TZ = "Pacific/Honolulu"; // UTC-10, no DST
    expect(formatVersionDate("2026-10-04")).toBe("4 Oct 2026");
  });
});
