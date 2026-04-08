"use server";

import { authenticatedFetch } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/session";
import type { ReadingDetail } from "@/types/reading";

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

  return { ok: true, data: result.data };
};
