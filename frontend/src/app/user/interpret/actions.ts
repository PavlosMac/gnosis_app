"use server";

import { authenticatedFetch } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/session";
import { interpretRequestSchema } from "@/lib/validation/interpret-schemas";
import type { InterpretRequest, InterpretResponse, InterpretResult } from "@/types/interpret";

export const getInterpretation = async (
  payload: InterpretRequest
): Promise<InterpretResult> => {
  const user = await getCurrentUser();
  if (!user)
    return {
      ok: false,
      error: "You must be logged in to request an interpretation.",
    };
  if (user.credits < 1)
    return { ok: false, error: "Insufficient reading credits." };

  const parsed = interpretRequestSchema.safeParse(payload);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const result = await authenticatedFetch<InterpretResponse>(
    `${process.env.GNOSIS_API_BASE_URL}/llm/interpret`,
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
  return { ok: true, data: result.data };
};
