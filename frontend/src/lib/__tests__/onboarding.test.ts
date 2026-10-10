import { describe, expect, it } from "vitest";
import { isOnboardingExempt, onboardingRedirect } from "@/lib/onboarding";

const CURRENT = { terms: "2026-10-04", privacy: "2026-10-04" };
const record = (version: string) => ({ version, accepted_at: "2026-10-04T10:00:00Z" });
const current = { terms: record("2026-10-04"), privacy: record("2026-10-04") };

describe("onboardingRedirect", () => {
  it("is null for an active user with current consents", () => {
    expect(onboardingRedirect({ status: "active", consents: current }, CURRENT)).toBeNull();
  });

  it("sends a pending user to /verify-email before anything else", () => {
    expect(
      onboardingRedirect({ status: "pending_verification", consents: {} }, CURRENT)
    ).toBe("/verify-email");
  });

  it("sends a user with stale consents to /accept-terms", () => {
    const consents = { ...current, terms: record("2026-09-01") };
    expect(onboardingRedirect({ status: "active", consents }, CURRENT)).toBe("/accept-terms");
    expect(onboardingRedirect({ status: "active", consents: {} }, CURRENT)).toBe("/accept-terms");
  });

  it("does not gate when the backend sends no consents key at all", () => {
    expect(onboardingRedirect({ status: "active", consents: undefined }, CURRENT)).toBeNull();
  });
});

describe("isOnboardingExempt", () => {
  it("lets a user reach account deletion without accepting new terms", () => {
    expect(isOnboardingExempt("/user/profile/delete-account")).toBe(true);
  });

  it("gates every other /user path", () => {
    expect(isOnboardingExempt("/user/profile")).toBe(false);
    expect(isOnboardingExempt("/user/profile/manage-consent")).toBe(false);
    expect(isOnboardingExempt("/user/profile/delete-account-not")).toBe(false);
    expect(isOnboardingExempt("/user/readings")).toBe(false);
  });

  it("gates when the path is unknown", () => {
    expect(isOnboardingExempt(null)).toBe(false);
    expect(isOnboardingExempt(undefined)).toBe(false);
  });
});
