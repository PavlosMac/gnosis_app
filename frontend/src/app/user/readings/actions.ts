"use server";

import { authenticatedFetch } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/session";
import type { PaginatedReadings } from "@/types/reading";
import type { ListContext } from "@/lib/reading-list-context";
import { READINGS_PAGE_SIZE } from "@/lib/reading-list-context";
import { planAdjacency, type AdjacencyResult } from "@/lib/reading-adjacency";

interface ReadingsFilters {
  spreadType?: string;
  tags?: string;
  birthDate?: string;
}

export const getReadings = async (
  page = 1,
  pageSize = 10,
  filters?: ReadingsFilters
): Promise<
  | { ok: true; data: PaginatedReadings }
  | { ok: false; error: string }
> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  const safePage = Math.max(1, Math.floor(Number(page)) || 1);
  const safePageSize = Math.min(50, Math.max(1, Math.floor(Number(pageSize)) || 10));

  const params = new URLSearchParams({
    page: String(safePage),
    page_size: String(safePageSize),
  });
  if (filters?.spreadType) params.set("spread_type", filters.spreadType);
  if (filters?.tags) params.set("tags", filters.tags);
  if (filters?.birthDate) params.set("birth_date", filters.birthDate);

  const result = await authenticatedFetch<PaginatedReadings>(
    `/api/v1/readings?${params.toString()}`,
    { method: "GET" }
  );

  if (!result.ok)
    return { ok: false, error: result.message ?? "Failed to fetch readings." };

  return { ok: true, data: result.data };
};

const NO_ADJACENCY: AdjacencyResult = { prev: null, next: null, position: null };

/**
 * Find the readings before and after `id` within the filtered sequence the
 * user was browsing. One fetch for the context page; one more only when the
 * reading sits at a page edge. Any failure degrades to "no neighbors".
 */
export const getAdjacentReadings = async (
  id: string,
  ctx: ListContext
): Promise<AdjacencyResult> => {
  const filters: ReadingsFilters = {
    spreadType: ctx.spreadType,
    tags: ctx.tags,
    birthDate: ctx.birthDate,
  };

  const result = await getReadings(ctx.page, READINGS_PAGE_SIZE, filters);
  if (!result.ok) return NO_ADJACENCY;

  const plan = planAdjacency(
    result.data.items.map((item) => item._id),
    id,
    ctx.page,
    READINGS_PAGE_SIZE,
    result.data.total
  );
  if (!plan) return NO_ADJACENCY;

  const fetchEdge = async (page: number, take: "first" | "last") => {
    const edge = await getReadings(page, READINGS_PAGE_SIZE, filters);
    if (!edge.ok || edge.data.items.length === 0) return null;
    const items = edge.data.items;
    return { id: items[take === "first" ? 0 : items.length - 1]._id, page };
  };

  const prev = plan.prevInPage
    ? { id: plan.prevInPage, page: ctx.page }
    : plan.needsPrevPage
      ? await fetchEdge(ctx.page - 1, "last")
      : null;
  const next = plan.nextInPage
    ? { id: plan.nextInPage, page: ctx.page }
    : plan.needsNextPage
      ? await fetchEdge(ctx.page + 1, "first")
      : null;

  return { prev, next, position: { index: plan.position, total: plan.total } };
};
