/** A neighbor in the filtered sequence, with the list page it lives on */
export interface AdjacentReading {
  id: string;
  page: number;
}

export interface AdjacencyResult {
  prev: AdjacentReading | null;
  next: AdjacentReading | null;
  /** 1-based position of the current reading within the whole result set */
  position: { index: number; total: number } | null;
}

export interface AdjacencyPlan {
  /** 0-based index of the current reading within its page */
  index: number;
  /** 1-based position within the whole result set */
  position: number;
  total: number;
  prevInPage: string | null;
  nextInPage: string | null;
  /** Current reading is first on its page and an earlier page exists */
  needsPrevPage: boolean;
  /** Current reading is last on its page and a later page exists */
  needsNextPage: boolean;
}

/**
 * Locate a reading within its fetched page and describe its neighbors.
 * Returns null when the reading is not on the page (stale link, the reading
 * left the filter, or an out-of-range page param).
 */
export const planAdjacency = (
  ids: string[],
  currentId: string,
  page: number,
  pageSize: number,
  total: number
): AdjacencyPlan | null => {
  const index = ids.indexOf(currentId);
  if (index === -1) return null;

  return {
    index,
    position: (page - 1) * pageSize + index + 1,
    total,
    prevInPage: index > 0 ? ids[index - 1] : null,
    nextInPage: index < ids.length - 1 ? ids[index + 1] : null,
    needsPrevPage: index === 0 && page > 1,
    needsNextPage: index === ids.length - 1 && page * pageSize < total,
  };
};

/** A single-item API request: which backend page (at page_size=1) lands on a
 * given 0-based overall index, avoiding a full page fetch to read one id. */
export interface EdgeFetch {
  page: number;
  pageSize: 1;
}

/**
 * The previous page is always full when the current page needs it (only the
 * very last page can be short), so its last item sits at overall index
 * `(currentPage - 1) * pageSize - 1`.
 */
export const prevPageEdgeFetch = (currentPage: number, pageSize: number): EdgeFetch => ({
  page: (currentPage - 1) * pageSize,
  pageSize: 1,
});

/** The next page's first item sits at overall index `currentPage * pageSize`. */
export const nextPageEdgeFetch = (currentPage: number, pageSize: number): EdgeFetch => ({
  page: currentPage * pageSize + 1,
  pageSize: 1,
});
