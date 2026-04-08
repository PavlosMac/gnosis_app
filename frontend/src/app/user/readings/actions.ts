"use server";

import { authenticatedFetch } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/session";
import type { PaginatedReadings } from "@/types/reading";

export const getReadings = async (
  page = 1,
  pageSize = 10
): Promise<
  | { ok: true; data: PaginatedReadings }
  | { ok: false; error: string }
> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  const safePage = Math.max(1, Math.floor(Number(page)) || 1);
  const safePageSize = Math.min(50, Math.max(1, Math.floor(Number(pageSize)) || 10));

  const result = await authenticatedFetch<PaginatedReadings>(
    `/api/v1/readings?page=${safePage}&page_size=${safePageSize}`,
    { method: "GET" }
  );

  if (!result.ok)
    return { ok: false, error: result.message ?? "Failed to fetch readings." };

  return { ok: true, data: result.data };
};
