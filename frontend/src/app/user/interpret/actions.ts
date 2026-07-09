"use server";

import { authenticatedFetch } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/session";
import {
  interpretRequestSchema,
  saveInterpretationSchema,
} from "@/lib/validation/interpret-schemas";
import type {
  InterpretRequest,
  Interpretation,
  CreateReadingResult,
  GenerateInterpretationResult,
  SaveInterpretationResult,
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

export const generateInterpretation = async (
  readingId: string
): Promise<GenerateInterpretationResult> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: NOT_LOGGED_IN };

  const result = await authenticatedFetch<Interpretation>(
    `/api/v1/readings/${readingId}/interpretation/generate`,
    { method: "POST", body: JSON.stringify({}) }
  );

  if (!result.ok)
    return { ok: false, error: result.message ?? "The oracle could not be reached." };

  return { ok: true, data: result.data };
};

export const saveInterpretation = async (
  readingId: string,
  interpretation: Interpretation
): Promise<SaveInterpretationResult> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: NOT_LOGGED_IN };

  const parsed = saveInterpretationSchema.safeParse(interpretation);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid interpretation." };

  const result = await authenticatedFetch<Interpretation>(
    `/api/v1/readings/${readingId}/interpretation`,
    { method: "POST", body: JSON.stringify(parsed.data) }
  );

  if (!result.ok)
    return { ok: false, error: result.message ?? "The interpretation could not be saved." };

  return { ok: true };
};
