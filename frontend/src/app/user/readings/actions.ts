"use server";

import { authenticatedFetch } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/session";
import type { PaginatedReadings } from "@/types/reading";
import type { ListContext, ListSort } from "@/lib/reading-list-context";
import { clampPage, pageSizeOf, sanitizePageSize } from "@/lib/reading-list-context";
import {
  planAdjacency,
  prevPageEdgeFetch,
  nextPageEdgeFetch,
  type AdjacencyResult,
} from "@/lib/reading-adjacency";

interface ReadingsFilters {
  spreadType?: string;
  tags?: string;
  birthDate?: string;
  /** Explicit sort; omit for the default, newest first */
  sort?: ListSort;
}

type ReadingsResult =
  | { ok: true; data: PaginatedReadings }
  | { ok: false; error: string };

/**
 * Fetches one page of the current user's readings. `page`/`pageSize` are taken
 * as given — the caller is responsible for validating them (public entry
 * points sanitize against untrusted input; `getAdjacentReadings`'s internal
 * single-item lookups pass an already-known-safe page_size of 1).
 */
const fetchReadingsPage = async (
  page: number,
  pageSize: number,
  filters?: ReadingsFilters
): Promise<ReadingsResult> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (filters?.spreadType) params.set("spread_type", filters.spreadType);
  if (filters?.tags) params.set("tags", filters.tags);
  if (filters?.birthDate) params.set("birth_date", filters.birthDate);
  if (filters?.sort) {
    params.set("sort", filters.sort.field);
    params.set("order", filters.sort.order);
  }

  const result = await authenticatedFetch<PaginatedReadings>(
    `/api/v1/readings?${params.toString()}`,
    { method: "GET" }
  );

  if (!result.ok)
    return { ok: false, error: result.message ?? "Failed to fetch readings." };

  return { ok: true, data: result.data };
};

export const getReadings = async (
  page = 1,
  pageSize = 10,
  filters?: ReadingsFilters
): Promise<ReadingsResult> =>
  fetchReadingsPage(clampPage(Number(page)), sanitizePageSize(Number(pageSize)), filters);

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
    sort: ctx.sort,
  };
  // Same order and page size as the list the reading was opened from —
  // otherwise its neighbors here would not match the list's.
  const pageSize = pageSizeOf(ctx);

  const result = await getReadings(ctx.page, pageSize, filters);
  if (!result.ok) return NO_ADJACENCY;

  const plan = planAdjacency(
    result.data.items.map((item) => item._id),
    id,
    ctx.page,
    pageSize,
    result.data.total
  );
  if (!plan) return NO_ADJACENCY;

  // A single-item fetch (page_size=1) rather than a full page — only the one id
  // at the page boundary is needed to link to the neighboring reading.
  const fetchEdgeId = async (query: { page: number; pageSize: 1 }) => {
    const edge = await fetchReadingsPage(clampPage(query.page), query.pageSize, filters);
    return edge.ok && edge.data.items.length > 0 ? edge.data.items[0]._id : null;
  };

  const prev = plan.prevInPage
    ? { id: plan.prevInPage, page: ctx.page }
    : plan.needsPrevPage
      ? await fetchEdgeId(prevPageEdgeFetch(ctx.page, pageSize)).then((edgeId) =>
          edgeId ? { id: edgeId, page: ctx.page - 1 } : null
        )
      : null;
  const next = plan.nextInPage
    ? { id: plan.nextInPage, page: ctx.page }
    : plan.needsNextPage
      ? await fetchEdgeId(nextPageEdgeFetch(ctx.page, pageSize)).then((edgeId) =>
          edgeId ? { id: edgeId, page: ctx.page + 1 } : null
        )
      : null;

  return { prev, next, position: { index: plan.position, total: plan.total } };
};
