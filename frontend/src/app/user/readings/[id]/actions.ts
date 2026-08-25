"use server";

import { authenticatedFetch } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/session";
import type { ReadingDetail, UpdateTagsResult } from "@/types/reading";
import { updateTagsSchema } from "@/lib/validation/reading-schemas";

export const getReading = async (
  id: string
): Promise<
  | { ok: true; data: ReadingDetail }
  | { ok: false; error: string }
> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  if (!id || !/^[a-f0-9]{24}$/.test(id))
    return { ok: false, error: "Invalid reading ID." };

  const result = await authenticatedFetch<ReadingDetail>(
    `/api/v1/readings/${id}`,
    { method: "GET" }
  );

  if (!result.ok)
    return { ok: false, error: result.message ?? "Failed to fetch reading." };

  if (result.data.user_id !== user.id) {
    return { ok: false, error: "You do not have permission to view this reading." };
  }

  console.log("[TAGS] GET tags", { id, tags: result.data.tags });

  // Legacy readings (pre multi-lens) have no interpretations key
  return {
    ok: true,
    data: { ...result.data, interpretations: result.data.interpretations ?? [] },
  };
};

export const updateReadingTags = async (
  readingId: string,
  tags: string[]
): Promise<UpdateTagsResult> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  const parsed = updateTagsSchema.safeParse({ tags });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const body = { tags: tags.join(", ") };
  console.log("[TAGS] PATCH payload", { readingId, body });

  const result = await authenticatedFetch<ReadingDetail>(
    `/api/v1/readings/${readingId}/tags`,
    { method: "PATCH", body: JSON.stringify(body) }
  );

  if (!result.ok)
    return { ok: false, error: result.message ?? "Failed to update tags." };

  console.log("[TAGS] PATCH response tags", result.data.tags);

  return { ok: true, data: result.data };
};
