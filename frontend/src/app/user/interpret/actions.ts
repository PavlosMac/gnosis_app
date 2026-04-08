"use server";

import { authenticatedFetch } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/session";
import { interpretRequestSchema } from "@/lib/validation/interpret-schemas";
import type { InterpretRequest, InterpretResponse, InterpretResult } from "@/types/interpret";
import type { ReadingDetail } from "@/types/reading";

export const getInterpretation = async (
  payload: InterpretRequest
): Promise<InterpretResult> => {
  const user = await getCurrentUser();
  if (!user)
    return {
      ok: false,
      error: "You must be logged in to request an interpretation.",
    };

  const parsed = interpretRequestSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join('.') ?? '';
    const detail = path ? `${path}: ${issue?.message}` : (issue?.message ?? "Invalid request.");
    return { ok: false, error: detail };
  }

  const result = await authenticatedFetch<ReadingDetail>(
    `/api/v1/readings`,
    {
      method: "POST",
      body: JSON.stringify(parsed.data),
    }
  );

  if (!result.ok)
    return {
      ok: false,
      error: result.message ?? "The oracle could not be reached.",
    };

  // Extract the InterpretResponse shape the modal expects
  const data: InterpretResponse = {
    card_interpretations: result.data.card_interpretations,
    synthesis: result.data.synthesis,
    model: result.data.model,
    tokens_used: result.data.tokens_used,
  };

  return { ok: true, data };
};
