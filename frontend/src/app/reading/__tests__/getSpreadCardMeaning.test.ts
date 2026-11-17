import { beforeEach, describe, expect, it, vi } from "vitest";

// Only the action's own decisions are under test: the index guard and the error
// mapping. The API client is replaced.
const publicFetch = vi.fn();
const authenticatedFetch = vi.fn();
vi.mock("@/lib/api-client", () => ({
  publicFetch: (...args: unknown[]) => publicFetch(...args),
  authenticatedFetch: (...args: unknown[]) => authenticatedFetch(...args),
}));

const { getSpreadCardMeaning } = await import("@/app/reading/actions");

const MEANING = { number: 76, name: "Queen of Swords", meaning: "Clear.\n\nCold." };

describe("getSpreadCardMeaning", () => {
  beforeEach(() => {
    publicFetch.mockReset();
    authenticatedFetch.mockReset();
  });

  it("fetches the card by its deck index without a session", async () => {
    publicFetch.mockResolvedValue({ ok: true, data: MEANING });

    const result = await getSpreadCardMeaning(76);

    expect(result).toEqual({ ok: true, data: MEANING });
    expect(publicFetch).toHaveBeenCalledWith(
      "/api/v1/cards/spread/76",
      expect.objectContaining({ method: "GET" })
    );
    expect(authenticatedFetch).not.toHaveBeenCalled();
  });

  it("accepts both ends of the deck", async () => {
    publicFetch.mockResolvedValue({ ok: true, data: MEANING });

    expect(await getSpreadCardMeaning(0)).toMatchObject({ ok: true });
    expect(await getSpreadCardMeaning(77)).toMatchObject({ ok: true });
  });

  it("refuses an index outside the deck without calling the API", async () => {
    expect(await getSpreadCardMeaning(78)).toMatchObject({ ok: false });
    expect(await getSpreadCardMeaning(-1)).toMatchObject({ ok: false });
    expect(await getSpreadCardMeaning(1.5)).toMatchObject({ ok: false });
    expect(await getSpreadCardMeaning(Number.NaN)).toMatchObject({ ok: false });
    expect(await getSpreadCardMeaning("11" as unknown as number)).toMatchObject({ ok: false });
    expect(publicFetch).not.toHaveBeenCalled();
  });

  it("explains a 404 as a card not written yet", async () => {
    publicFetch.mockResolvedValue({ ok: false, status: 404, message: "Not found" });

    expect(await getSpreadCardMeaning(40)).toEqual({
      ok: false,
      error: "This card's meaning has not been written yet.",
    });
  });

  it("passes any other failure message through", async () => {
    publicFetch.mockResolvedValue({ ok: false, status: 503, message: "Busy" });

    expect(await getSpreadCardMeaning(40)).toEqual({ ok: false, error: "Busy" });
  });
});
