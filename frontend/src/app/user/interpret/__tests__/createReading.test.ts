import { beforeEach, describe, expect, it, vi } from "vitest";

// Only the action's own decisions are under test: the session gate and how a
// failure is reported to the page. Session and API client are replaced.
const authenticatedFetch = vi.fn();
vi.mock("@/lib/api-client", () => ({
  authenticatedFetch: (...args: unknown[]) => authenticatedFetch(...args),
}));
const requireConsentedUser = vi.fn();
const consentRefusalReason = vi.fn();
vi.mock("@/lib/session", () => ({
  requireConsentedUser: () => requireConsentedUser(),
  consentRefusalReason: () => consentRefusalReason(),
}));

const { createReading } = await import("@/app/user/interpret/actions");
const { ONBOARDING_REQUIRED_MESSAGE } = await import("@/lib/onboarding");

const PAYLOAD = {
  spread_name: "Three Card",
  cards: [{ name: "The Fool", position: "Past", orientation: "upright" as const }],
};
const USER = { id: "u1" };

describe("createReading", () => {
  beforeEach(() => {
    authenticatedFetch.mockReset();
    requireConsentedUser.mockReset();
    consentRefusalReason.mockReset();
  });

  it("saves the reading for a consented user", async () => {
    requireConsentedUser.mockResolvedValue(USER);
    authenticatedFetch.mockResolvedValue({ ok: true, data: { _id: "r1" } });

    expect(await createReading(PAYLOAD)).toEqual({ ok: true, readingId: "r1" });
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/v1/readings",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("tells the page the session is gone so it can offer a login, with save wording", async () => {
    requireConsentedUser.mockResolvedValue(null);
    consentRefusalReason.mockResolvedValue("unauthenticated");

    const result = await createReading(PAYLOAD);

    expect(result).toEqual({
      ok: false,
      error: "Log in to save this reading.",
      unauthenticated: true,
    });
    expect(authenticatedFetch).not.toHaveBeenCalled();
  });

  it("does not call an outstanding onboarding step a lost session", async () => {
    requireConsentedUser.mockResolvedValue(null);
    consentRefusalReason.mockResolvedValue("onboarding");

    const result = await createReading(PAYLOAD);

    expect(result).toEqual({ ok: false, error: ONBOARDING_REQUIRED_MESSAGE });
    expect(result).not.toHaveProperty("unauthenticated");
  });

  it("does not call a backend outage a lost session", async () => {
    requireConsentedUser.mockResolvedValue(null);
    consentRefusalReason.mockResolvedValue("unavailable");

    const result = await createReading(PAYLOAD);

    expect(result).toEqual({ ok: false, error: "Could not reach the server. Please try again." });
    expect(result).not.toHaveProperty("unauthenticated");
  });

  it("forwards a session that died between the gate and the save", async () => {
    requireConsentedUser.mockResolvedValue(USER);
    authenticatedFetch.mockResolvedValue({
      ok: false,
      status: 401,
      message: "Session expired. Please log in again.",
      unauthenticated: true,
    });

    expect(await createReading(PAYLOAD)).toEqual({
      ok: false,
      error: "Session expired. Please log in again.",
      unauthenticated: true,
    });
  });

  it("reports any other failure without the flag", async () => {
    requireConsentedUser.mockResolvedValue(USER);
    authenticatedFetch.mockResolvedValue({ ok: false, status: 503, message: "Busy" });

    const result = await createReading(PAYLOAD);

    expect(result).toEqual({ ok: false, error: "Busy" });
    expect(result).not.toHaveProperty("unauthenticated");
  });
});
