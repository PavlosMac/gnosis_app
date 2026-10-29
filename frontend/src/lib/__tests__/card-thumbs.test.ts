import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { TAROT_DECK, cardThumbUrl, CARD_THUMB_DIR } from "@/lib/cards";

describe("cardThumbUrl", () => {
  it("maps the external full image to the local thumb with the same basename", () => {
    expect(cardThumbUrl({ imageUrl: "https://steve-p.org/cards/small/sm_RWSa-T-00.webp" })).toBe(
      "/cards/thumbs/sm_RWSa-T-00.webp",
    );
  });

  it("has a generated thumbnail on disk for every card in the deck", () => {
    const missing = TAROT_DECK.map(cardThumbUrl).filter(
      (url) => !existsSync(resolve(__dirname, "../../../public", url.slice(1))),
    );
    expect(missing).toEqual([]);
    expect(new Set(TAROT_DECK.map(cardThumbUrl)).size).toBe(TAROT_DECK.length);
    expect(CARD_THUMB_DIR).toBe("/cards/thumbs");
  });
});
