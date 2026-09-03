"use server";

import { authenticatedFetch } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/session";
import {
  interpretRequestSchema,
  readingIdSchema,
} from "@/lib/validation/interpret-schemas";
import type {
  InterpretRequest,
  Interpretation,
  CreateReadingResult,
  GenerateInterpretationResult,
} from "@/types/interpret";

const NOT_LOGGED_IN = "You must be logged in to request an interpretation.";


export const createReading = async (
  payload: InterpretRequest
): Promise<CreateReadingResult> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: NOT_LOGGED_IN };

  const parsed = interpretRequestSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join(".") ?? "";
    const detail = path ? `${path}: ${issue?.message}` : (issue?.message ?? "Invalid request.");
    return { ok: false, error: detail };
  }

  const result = await authenticatedFetch<{ _id: string }>(`/api/v1/readings`, {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });

  if (!result.ok)
    return { ok: false, error: result.message ?? "The reading could not be saved." };

  return { ok: true, readingId: result.data._id };
};

// The one-step response: the interpretation is persisted before this returns.
// A repeat call is idempotent — the stored interpretation comes back with the
// budget untouched.
interface GenerateInterpretationResponse {
  interpretation: Interpretation;
  remaining_budget_usd: number;
}

export const generateInterpretation = async (
  readingId: string
): Promise<GenerateInterpretationResult> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: NOT_LOGGED_IN, unauthenticated: true };

  if (!readingIdSchema.safeParse(readingId).success)
    return { ok: false, error: "Invalid reading ID." };

  const result = await authenticatedFetch<GenerateInterpretationResponse>(
    `/api/v1/readings/${readingId}/interpretation`,
    { method: "POST" }
  );

  if (!result.ok)
    return {
      ok: false,
      error: result.message ?? "The oracle could not be reached.",
      unauthenticated: result.unauthenticated,
    };

  return {
    ok: true,
    data: result.data.interpretation,
    remainingBudgetUsd: result.data.remaining_budget_usd,
  };
};
