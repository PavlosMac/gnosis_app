import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// next/image needs the Next runtime; a plain <img> is enough for markup checks
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) =>
    React.createElement("img", { alt: String(props.alt ?? "") }),
}));

// The action module pulls in server-only code, so it is replaced (it has its own test)
vi.mock("@/app/reading/actions", () => ({ getSpreadCardMeaning: vi.fn() }));

const {
  clearSpreadMeaningCache,
  deckIndexForCard,
  loadSpreadMeaning,
  spreadDialogDescription,
  spreadDialogSubtitle,
  spreadDialogTitle,
  spreadMeaningParagraphs,
} = await import("@/components/SpreadCardMeaningModal");
const { CardMeaningBody } = await import("@/components/CardMeaningDialog");
const { getSpreadCardMeaning } = await import("@/app/reading/actions");
const { getCardByIndex } = await import("@/services/cardLookup");

const QUEEN = getCardByIndex(76);
const MEANING = {
  number: 76,
  name: "Queen of Swords",
  meaning: "Clear judgment.\n\nHer shadow is coldness.\n\n\nA third thought.",
};

describe("deckIndexForCard", () => {
  it("resolves the deck index from the name, ignoring a rewritten idx", () => {
    // the draw flow replaces idx with the slot in the shuffled grid
    const drawn = { ...QUEEN, idx: 3 };
    expect(deckIndexForCard(drawn)).toBe(76);
    expect(deckIndexForCard({ name: "The Fool" })).toBe(0);
    expect(deckIndexForCard({ name: "King of Swords" })).toBe(77);
  });

  it("is -1 for a name that is not in the deck", () => {
    expect(deckIndexForCard({ name: "The Joker" })).toBe(-1);
  });
});

describe("spread dialog text", () => {
  it("splits the meaning into its paragraphs", () => {
    expect(spreadMeaningParagraphs(MEANING)).toEqual([
      "Clear judgment.",
      "Her shadow is coldness.",
      "A third thought.",
    ]);
  });

  it("marks a reversed card in the title only", () => {
    expect(spreadDialogTitle({ card: QUEEN, reversed: false })).toBe("Queen of Swords");
    expect(spreadDialogTitle({ card: QUEEN, reversed: true })).toBe("Queen of Swords (Reversed)");
  });

  it("builds the subtitle from the position name alone", () => {
    const base = { card: QUEEN, reversed: false };

    expect(spreadDialogSubtitle({ ...base, position: "Past" })).toBe("Past");
    expect(spreadDialogSubtitle({ ...base, position: " Chesed" })).toBe("Chesed");
    expect(spreadDialogSubtitle({ ...base, position: "" })).toBeUndefined();
    expect(spreadDialogSubtitle(base)).toBeUndefined();
  });

  it("keeps the whole position description, trimmed, for the body", () => {
    const base = { card: QUEEN, reversed: false };
    const long =
      "Subconscious temperament. The dominant psychic complex. What is hidden. Secret desires. Fears. Worries. Self-image.";

    expect(spreadDialogDescription({ ...base, positionDescription: `${long}\n` })).toBe(long);
    expect(spreadDialogDescription({ ...base, positionDescription: "  " })).toBeUndefined();
    expect(spreadDialogDescription(base)).toBeUndefined();
  });
});

describe("the spread card body", () => {
  it("shows every paragraph, unlabelled, beside the card", () => {
    const html = renderToStaticMarkup(
      <CardMeaningBody
        card={{ ...QUEEN, reversed: true }}
        state={{ status: "result", meaning: MEANING }}
        paragraphs={spreadMeaningParagraphs}
      />
    );

    expect((html.match(/<p/g) ?? []).length).toBe(3);
    expect(html.indexOf("Clear judgment.")).toBeLessThan(html.indexOf("Her shadow is coldness."));
    expect(html).not.toMatch(/>\s*(Upright|Reversed|Shadow)\s*</);
    expect(html).toContain('alt="Queen of Swords"');
    expect(html).toContain("rotate-180");
  });

  it("shows the waiting line and an error", () => {
    const loading = renderToStaticMarkup(
      <CardMeaningBody card={QUEEN} state={{ status: "loading" }} paragraphs={spreadMeaningParagraphs} />
    );
    const failed = renderToStaticMarkup(
      <CardMeaningBody
        card={QUEEN}
        state={{ status: "error", message: "This card's meaning has not been written yet." }}
        paragraphs={spreadMeaningParagraphs}
      />
    );

    expect(loading).toContain('role="status"');
    expect(failed).toContain("has not been written yet");
  });
});

describe("loadSpreadMeaning", () => {
  const action = vi.mocked(getSpreadCardMeaning);

  beforeEach(() => {
    clearSpreadMeaningCache();
    action.mockReset();
  });

  it("fetches a card once and serves reopenings from the cache", async () => {
    action.mockResolvedValue({ ok: true, data: MEANING });

    const first = await loadSpreadMeaning(76);
    const second = await loadSpreadMeaning(76);

    expect(first).toEqual({ status: "result", meaning: MEANING });
    expect(second).toEqual(first);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("does not cache an error, so the next open tries again", async () => {
    action.mockResolvedValueOnce({ ok: false, error: "Nothing yet." });
    action.mockResolvedValueOnce({ ok: true, data: MEANING });

    expect(await loadSpreadMeaning(76)).toEqual({ status: "error", message: "Nothing yet." });
    expect((await loadSpreadMeaning(76)).status).toBe("result");
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("turns a thrown action into an error state", async () => {
    action.mockRejectedValue(new Error("network"));

    expect((await loadSpreadMeaning(76)).status).toBe("error");
  });
});
