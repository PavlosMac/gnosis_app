import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// next/image needs the Next runtime; a plain <img> is enough for markup checks
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) =>
    React.createElement("img", { alt: String(props.alt ?? "") }),
}));

// TallyCard's dialog calls a server action; the action module pulls in server-only
// code, so it is replaced (the action has its own test)
vi.mock("@/app/user/profile/actions", () => ({ getMajorArcanaMeaning: vi.fn() }));

const { CardMeaningView, clearMeaningCache, loadMeaning } = await import(
  "@/app/user/profile/CardMeaningModal"
);
const { getMajorArcanaMeaning } = await import("@/app/user/profile/actions");
const { getCardByIndex } = await import("@/services/cardLookup");

const CARD = getCardByIndex(12);
const MEANING = {
  number: 12,
  name: "The Hanged Man",
  upright: "Held still, the world turns.",
  shadow: "Held too long, stillness sours.",
};

describe("CardMeaningView", () => {
  it("shows the two paragraphs in order with no section labels", () => {
    const html = renderToStaticMarkup(
      <CardMeaningView card={CARD} state={{ status: "result", meaning: MEANING }} />
    );

    const upright = html.indexOf(MEANING.upright);
    const shadow = html.indexOf(MEANING.shadow);
    expect(upright).toBeGreaterThan(-1);
    expect(shadow).toBeGreaterThan(upright);
    expect((html.match(/<p/g) ?? []).length).toBe(2);
    expect(html).not.toMatch(/>\s*Upright\s*</);
    expect(html).not.toMatch(/>\s*Shadow\s*</);
    expect(html).toContain('alt="The Hanged Man"');
  });

  it("shows a waiting line while the meaning loads", () => {
    const html = renderToStaticMarkup(<CardMeaningView card={CARD} state={{ status: "loading" }} />);

    expect(html).toContain('role="status"');
    expect(html).toContain("The card unfolds");
  });

  it("shows the error message", () => {
    const html = renderToStaticMarkup(
      <CardMeaningView card={CARD} state={{ status: "error", message: "Nothing yet." }} />
    );

    expect(html).toContain("Nothing yet.");
  });
});

describe("loadMeaning", () => {
  const action = vi.mocked(getMajorArcanaMeaning);

  beforeEach(() => {
    clearMeaningCache();
    action.mockReset();
  });

  it("fetches a card once and serves reopenings from the cache", async () => {
    action.mockResolvedValue({ ok: true, data: MEANING });

    const first = await loadMeaning(12);
    const second = await loadMeaning(12);

    expect(first).toEqual({ status: "result", meaning: MEANING });
    expect(second).toEqual(first);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("does not cache an error, so the next open tries again", async () => {
    action.mockResolvedValueOnce({ ok: false, error: "Nothing yet." });
    action.mockResolvedValueOnce({ ok: true, data: MEANING });

    expect(await loadMeaning(12)).toEqual({ status: "error", message: "Nothing yet." });
    expect((await loadMeaning(12)).status).toBe("result");
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("turns a thrown action into an error state", async () => {
    action.mockRejectedValue(new Error("network"));

    expect((await loadMeaning(12)).status).toBe("error");
  });
});
