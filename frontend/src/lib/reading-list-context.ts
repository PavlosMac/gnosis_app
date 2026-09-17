export const READINGS_PAGE_SIZE = 10;

/**
 * The list context a reading was opened from: current page plus active
 * filters, threaded through URLs so the detail page can link back to the
 * filtered list and step between its readings.
 */
export interface ListContext {
  page: number;
  spreadType?: string;
  tags?: string;
  birthDate?: string;
}

export const isValidIsoDate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());

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

  if (!pageParam && !spreadType && !tags && !birthDateParam) return null;

  return {
    page: Math.max(1, parseInt(pageParam ?? "1", 10) || 1),
    ...(spreadType ? { spreadType } : {}),
    ...(tags ? { tags } : {}),
    ...(birthDateParam && isValidIsoDate(birthDateParam)
      ? { birthDate: birthDateParam }
      : {}),
  };
};

export const listContextQueryString = (ctx: ListContext): string => {
  const params = new URLSearchParams();
  params.set("page", String(ctx.page));
  if (ctx.spreadType) params.set("spread_type", ctx.spreadType);
  if (ctx.tags) params.set("tags", ctx.tags);
  if (ctx.birthDate) params.set("birth_date", ctx.birthDate);
  return params.toString();
};

export const listHref = (ctx: ListContext | null): string =>
  ctx ? `/user/readings?${listContextQueryString(ctx)}` : "/user/readings";

export const readingHref = (id: string, ctx: ListContext | null): string =>
  ctx
    ? `/user/readings/${id}?${listContextQueryString(ctx)}`
    : `/user/readings/${id}`;
