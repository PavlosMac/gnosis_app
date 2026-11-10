import { beforeEach, describe, expect, it, vi } from "vitest";

// Only the action's own decisions are under test: the session check, the index guard
// and the error mapping. The API client and the session reader are replaced.
const authenticatedFetch = vi.fn();
vi.mock("@/lib/api-client", () => ({
  authenticatedFetch: (...args: unknown[]) => authenticatedFetch(...args),
}));
const getCurrentUser = vi.fn();
vi.mock("@/lib/session", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/password-reset", () => ({ requestPasswordResetEmail: vi.fn() }));

const { getMajorArcanaMeaning } = await import("@/app/user/profile/actions");

const MEANING = {
  number: 12,
  name: "The Hanged Man",
  upright: "Held still.",
  shadow: "Held too long.",
};

describe("getMajorArcanaMeaning", () => {
  beforeEach(() => {
    authenticatedFetch.mockReset();
    getCurrentUser.mockReset();
    getCurrentUser.mockResolvedValue({ id: "u1" });
  });

  it("fetches the card by its deck index", async () => {
    authenticatedFetch.mockResolvedValue({ ok: true, data: MEANING });

    const result = await getMajorArcanaMeaning(12);

    expect(result).toEqual({ ok: true, data: MEANING });
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/v1/cards/major-arcana/12",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("refuses an index outside the major arcana without calling the API", async () => {
    expect(await getMajorArcanaMeaning(22)).toMatchObject({ ok: false });
    expect(await getMajorArcanaMeaning(-1)).toMatchObject({ ok: false });
    expect(await getMajorArcanaMeaning(1.5)).toMatchObject({ ok: false });
    expect(authenticatedFetch).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    getCurrentUser.mockResolvedValue(null);

    expect(await getMajorArcanaMeaning(0)).toEqual({ ok: false, error: "You must be logged in." });
    expect(authenticatedFetch).not.toHaveBeenCalled();
  });

  it("explains a 404 as a card not written yet", async () => {
    authenticatedFetch.mockResolvedValue({ ok: false, status: 404, message: "Not found" });

    expect(await getMajorArcanaMeaning(0)).toEqual({
      ok: false,
      error: "This card's meaning has not been written yet.",
    });
  });

  it("passes any other failure message through", async () => {
    authenticatedFetch.mockResolvedValue({ ok: false, status: 503, message: "Busy" });

    expect(await getMajorArcanaMeaning(0)).toEqual({ ok: false, error: "Busy" });
  });
});
