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
