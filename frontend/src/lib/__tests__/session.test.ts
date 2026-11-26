import { beforeEach, describe, expect, it, vi } from "vitest";

// Only the session module's own decisions are under test: how one /auth/me
// answer becomes a user and a refusal reason. The API client is replaced.
const authenticatedFetch = vi.fn();
vi.mock("@/lib/api-client", () => ({
  authenticatedFetch: (...args: unknown[]) => authenticatedFetch(...args),
}));
// legal-documents is a server-only module; the registry itself is what the test needs
vi.mock("server-only", () => ({}));

const { getCurrentUser, consentRefusalReason, requireConsentedUser } = await import("@/lib/session");
const { CURRENT_VERSIONS } = await import("@/lib/legal-documents");

const ME = {
  _id: "u1",
  email: "ada@example.com",
  first_name: "Ada",
  last_name: "Lovelace",
  birth_date: null,
  status: "active",
  email_verified_at: null,
  consents: {
    terms: { version: CURRENT_VERSIONS.terms, accepted_at: "2026-01-01T00:00:00Z" },
    privacy: { version: CURRENT_VERSIONS.privacy, accepted_at: "2026-01-01T00:00:00Z" },
  },
  credits: 3,
  is_superadmin: false,
  created_at: "2026-01-01T00:00:00Z",
};

describe("session", () => {
  beforeEach(() => authenticatedFetch.mockReset());

  it("maps a 200 to the user, who is consented", async () => {
    authenticatedFetch.mockResolvedValue({ ok: true, data: ME });

    expect(await getCurrentUser()).toMatchObject({ id: "u1", email: "ada@example.com" });
    expect(await requireConsentedUser()).toMatchObject({ id: "u1" });
    expect(await consentRefusalReason()).toBe("onboarding");
  });

  it("calls a 401 a lost session", async () => {
    authenticatedFetch.mockResolvedValue({
      ok: false,
      status: 401,
      message: "Not authenticated",
      unauthenticated: true,
    });

    expect(await getCurrentUser()).toBeNull();
    expect(await consentRefusalReason()).toBe("unauthenticated");
  });

  it("does not call a backend outage a lost session", async () => {
    authenticatedFetch.mockResolvedValue({ ok: false, status: 502, message: "Bad Gateway" });

    expect(await getCurrentUser()).toBeNull();
    expect(await consentRefusalReason()).toBe("unavailable");
  });

  it("nor an unreachable backend", async () => {
    authenticatedFetch.mockResolvedValue({ ok: false, status: 0, message: "Could not reach the server." });

    expect(await consentRefusalReason()).toBe("unavailable");
  });

  it("calls a stale consent an outstanding onboarding step", async () => {
    authenticatedFetch.mockResolvedValue({
      ok: true,
      data: { ...ME, consents: { ...ME.consents, terms: { version: "2000-01-01", accepted_at: "x" } } },
    });

    expect(await getCurrentUser()).toMatchObject({ id: "u1" });
    expect(await requireConsentedUser()).toBeNull();
    expect(await consentRefusalReason()).toBe("onboarding");
  });
});
