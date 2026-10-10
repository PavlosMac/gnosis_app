import { describe, expect, it } from "vitest";
import { consentPayload, staleConsents, tickedDocuments } from "@/lib/consent";

const CURRENT = { terms: "2026-11-01", privacy: "2026-10-04" };
const record = (version: string) => ({ version, accepted_at: "2026-10-04T10:00:00Z" });

describe("staleConsents", () => {
  it("returns [] when consents is undefined (backend predates consent)", () => {
    expect(staleConsents(undefined, CURRENT)).toEqual([]);
  });

  it("returns both documents for a user who has accepted nothing", () => {
    expect(staleConsents({}, CURRENT)).toEqual(["terms", "privacy"]);
  });

  it("returns only the document whose stored version is behind", () => {
    const consents = { terms: record("2026-10-04"), privacy: record("2026-10-04") };
    expect(staleConsents(consents, CURRENT)).toEqual(["terms"]);
  });

  it("returns [] when both are current", () => {
    const consents = { terms: record("2026-11-01"), privacy: record("2026-10-04") };
    expect(staleConsents(consents, CURRENT)).toEqual([]);
  });
});

describe("tickedDocuments", () => {
  it("reads the checkbox fields a form posts", () => {
    const form = new FormData();
    form.set("acceptTerms", "on");
    expect(tickedDocuments(form)).toEqual(["terms"]);
    form.set("acceptPrivacy", "on");
    expect(tickedDocuments(form)).toEqual(["terms", "privacy"]);
  });

  it("ignores anything that is not a ticked checkbox", () => {
    const form = new FormData();
    form.set("acceptTerms", "off");
    form.set("acceptEverything", "on");
    expect(tickedDocuments(form)).toEqual([]);
  });
});

describe("consentPayload", () => {
  it("sends only the ticked documents, at the current versions", () => {
    expect(consentPayload(["terms"], CURRENT)).toEqual({ terms: "2026-11-01" });
    expect(consentPayload(["terms", "privacy"], CURRENT)).toEqual(CURRENT);
  });

  it("is empty when nothing is ticked", () => {
    expect(consentPayload([], CURRENT)).toEqual({});
  });

  it("never takes a version from anywhere but the server-side registry", () => {
    // Re-saving an already-current document resends the same version: a harmless
    // $set to the same value on the backend
    expect(consentPayload(["privacy"], CURRENT)).toEqual({ privacy: "2026-10-04" });
  });
});
