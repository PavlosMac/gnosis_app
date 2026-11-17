"use server";

import { z } from "zod";
import { DECK_MAX_INDEX } from "@/constants";
import { publicFetch } from "@/lib/api-client";
import type { SpreadCardMeaningResponse } from "@/types/auth";

export type SpreadCardMeaningResult =
  | { ok: true; data: SpreadCardMeaningResponse }
  | { ok: false; error: string };

const deckIndexSchema = z.number().int().min(0).max(DECK_MAX_INDEX);

/**
 * The stored general meaning of one card, by deck index (0 is The Fool, 77 the King of
 * Swords). Public on purpose: /reading is open to visitors and the text is the same for
 * everyone, so there is no session check and the call goes through `publicFetch`. The
 * backend answers 404 for a card whose text is not loaded, which the dialog shows as a
 * plain sentence rather than an error.
 */
export const getSpreadCardMeaning = async (index: number): Promise<SpreadCardMeaningResult> => {
  const parsed = deckIndexSchema.safeParse(index);
  if (!parsed.success) return { ok: false, error: "Not a card of the deck." };

  const result = await publicFetch<SpreadCardMeaningResponse>(
    `/api/v1/cards/spread/${parsed.data}`,
    { method: "GET" }
  );
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.status === 404
          ? "This card's meaning has not been written yet."
          : (result.message ?? "The card's meaning could not be reached."),
    };
  }
  return { ok: true, data: result.data };
};
