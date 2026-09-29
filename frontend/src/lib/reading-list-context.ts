/** Highest page the backend accepts; anything above it is clamped, not sent */
export const MAX_PAGE = 10_000;

/** Default page size — a URL without page_size means this */
export const READINGS_PAGE_SIZE = 10;

/** The page sizes the list offers; anything else in a URL is ignored */
export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

/** Fields the list can be sorted on — mirrors the backend whitelist */
export const SORT_FIELDS = ["created_at"] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortOrder = "asc" | "desc";

/** An explicit sort. No sort means the default, newest first. */
export interface ListSort {
  field: SortField;
  order: SortOrder;
}

export const isOldestFirst = (sort: ListSort | undefined): boolean =>
  sort?.field === "created_at" && sort.order === "asc";

/**
 * The sort to put in the URL for a date order. Newest first is the default, so
 * it folds back into "no sort" and the URL stays canonical.
 */
export const dateSort = (order: SortOrder): ListSort | undefined =>
  order === "desc" ? undefined : { field: "created_at", order };

/** Where the date toggle leads: the other direction. */
export const dateToggleTarget = (sort: ListSort | undefined): ListSort | undefined =>
  dateSort(isOldestFirst(sort) ? "desc" : "asc");

/**
 * The list context a reading was opened from: current page, active filters
 * and view settings (sort, page size), threaded through URLs so the detail
 * page can link back to the same list and step between its readings in the
 * same order.
 */
export interface ListContext {
  page: number;
  spreadType?: string;
  tags?: string;
  birthDate?: string;
  sort?: ListSort;
  /** Only set when it differs from READINGS_PAGE_SIZE */
  pageSize?: number;
}

export const pageSizeOf = (ctx: ListContext | null): number =>
  ctx?.pageSize ?? READINGS_PAGE_SIZE;

/**
 * A page size from an untrusted source (e.g. a direct server-action call),
 * snapped to one of the offered options. Anything off the whitelist falls
 * back to the default rather than being clamped to a nearby number — there
 * is no "closest" option that's still correct to serve.
 */
export const sanitizePageSize = (value: number): number => {
  const rounded = Math.floor(value);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(rounded)
    ? rounded
    : READINGS_PAGE_SIZE;
};

const parseSort = (
  field: string | undefined,
  order: string | undefined
): ListSort | undefined =>
  (SORT_FIELDS as readonly string[]).includes(field ?? "")
    ? { field: field as SortField, order: order === "asc" ? "asc" : "desc" }
    : undefined;

const parsePageSize = (value: string | undefined): number | undefined => {
  const size = Number(value);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(size) &&
    size !== READINGS_PAGE_SIZE
    ? size
    : undefined;
};

export const isValidIsoDate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());

/** 1..MAX_PAGE, with NaN and out-of-range values falling back to the nearest edge */
export const clampPage = (value: number): number =>
  Number.isFinite(value) ? Math.min(MAX_PAGE, Math.max(1, Math.floor(value))) : 1;

type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * Parse the list-context params off a URL. Returns null when none of the
 * context params are present at all — the signal that the visitor did not
 * arrive from the readings list.
 */
export const parseListContext = (sp: RawSearchParams): ListContext | null => {
  const pageParam = first(sp.page);
  const spreadType = first(sp.spread_type);
  const tags = first(sp.tags);
  const birthDateParam = first(sp.birth_date);
  const sortParam = first(sp.sort);
  const orderParam = first(sp.order);
  const pageSizeParam = first(sp.page_size);

  if (
    !pageParam &&
    !spreadType &&
    !tags &&
    !birthDateParam &&
    !sortParam &&
    !pageSizeParam
  )
    return null;

  const sort = parseSort(sortParam, orderParam);
  const pageSize = parsePageSize(pageSizeParam);

  return {
    page: clampPage(parseInt(pageParam ?? "1", 10)),
    ...(spreadType ? { spreadType } : {}),
    ...(tags ? { tags } : {}),
    ...(birthDateParam && isValidIsoDate(birthDateParam)
      ? { birthDate: birthDateParam }
      : {}),
    ...(sort ? { sort } : {}),
    ...(pageSize ? { pageSize } : {}),
  };
};

export const listContextQueryString = (ctx: ListContext): string => {
  const params = new URLSearchParams();
  params.set("page", String(ctx.page));
  if (ctx.spreadType) params.set("spread_type", ctx.spreadType);
  if (ctx.tags) params.set("tags", ctx.tags);
  if (ctx.birthDate) params.set("birth_date", ctx.birthDate);
  if (ctx.sort) {
    params.set("sort", ctx.sort.field);
    // desc is the backend default, so only asc needs spelling out
    if (ctx.sort.order === "asc") params.set("order", "asc");
  }
  if (ctx.pageSize && ctx.pageSize !== READINGS_PAGE_SIZE)
    params.set("page_size", String(ctx.pageSize));
  return params.toString();
};

export const listHref = (ctx: ListContext | null): string =>
  ctx ? `/user/readings?${listContextQueryString(ctx)}` : "/user/readings";

export type ReadingsViewState = "empty" | "no-matches-on-page" | "results";

/**
 * Which state the readings list should render for a page of results. Items
 * missing with nothing in the archive at all is a first-time-user "empty"
 * state; items missing with matches elsewhere means the page/page_size in
 * the URL overshot the result set, which needs a different message rather
 * than the "Begin a Reading" first-time CTA.
 */
export const readingsViewState = (
  itemCount: number,
  total: number
): ReadingsViewState => {
  if (itemCount > 0) return "results";
  return total === 0 ? "empty" : "no-matches-on-page";
};

export const readingHref = (id: string, ctx: ListContext | null): string =>
  ctx
    ? `/user/readings/${id}?${listContextQueryString(ctx)}`
    : `/user/readings/${id}`;
