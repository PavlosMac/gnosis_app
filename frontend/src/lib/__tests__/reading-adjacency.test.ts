import { describe, it, expect } from "vitest";
import { planAdjacency, prevPageEdgeFetch, nextPageEdgeFetch } from "@/lib/reading-adjacency";

const ids = ["a", "b", "c", "d", "e"];

describe("planAdjacency", () => {
  it("returns null when the reading is not on the page", () => {
    expect(planAdjacency(ids, "zz", 1, 10, 5)).toBeNull();
    expect(planAdjacency([], "a", 1, 10, 0)).toBeNull();
  });

  it("describes a middle item with both in-page neighbors", () => {
    expect(planAdjacency(ids, "c", 1, 10, 5)).toEqual({
      index: 2,
      position: 3,
      total: 5,
      prevInPage: "b",
      nextInPage: "d",
      needsPrevPage: false,
      needsNextPage: false,
    });
  });

  it("first item on page 1 has no prev at all", () => {
    const plan = planAdjacency(ids, "a", 1, 10, 5)!;
    expect(plan.prevInPage).toBeNull();
    expect(plan.needsPrevPage).toBe(false);
  });

  it("first item on a later page needs the previous page", () => {
    const plan = planAdjacency(ids, "a", 2, 10, 15)!;
    expect(plan.prevInPage).toBeNull();
    expect(plan.needsPrevPage).toBe(true);
    expect(plan.position).toBe(11);
  });

  it("last item on the last page has no next at all", () => {
    // page 2 of 15 items, 5 on this page: 2*10 >= 15 → no later page
    const plan = planAdjacency(ids, "e", 2, 10, 15)!;
    expect(plan.nextInPage).toBeNull();
    expect(plan.needsNextPage).toBe(false);
  });

  it("last item on a non-last page needs the next page", () => {
    const fullPage = [...Array(10)].map((_, i) => `id${i}`);
    const plan = planAdjacency(fullPage, "id9", 1, 10, 15)!;
    expect(plan.nextInPage).toBeNull();
    expect(plan.needsNextPage).toBe(true);
  });

  it("single-item last page beyond page 1 needs prev only", () => {
    const plan = planAdjacency(["only"], "only", 2, 10, 11)!;
    expect(plan.needsPrevPage).toBe(true);
    expect(plan.needsNextPage).toBe(false);
    expect(plan.position).toBe(11);
    expect(plan.total).toBe(11);
  });

  it("computes overall position across pages", () => {
    // page 3, index 4, pageSize 10 → 25th of the whole set
    const page3 = [...Array(10)].map((_, i) => `p3-${i}`);
    expect(planAdjacency(page3, "p3-4", 3, 10, 40)!.position).toBe(25);
  });
});

describe("prevPageEdgeFetch", () => {
  it("targets the last item of the previous page with a single-item fetch", () => {
    // page 2, pageSize 10 → previous page's last item is overall index 9 →
    // page_size=1 needs backend page 10 to land skip=9
    expect(prevPageEdgeFetch(2, 10)).toEqual({ page: 10, pageSize: 1 });
    expect(prevPageEdgeFetch(3, 20)).toEqual({ page: 40, pageSize: 1 });
  });
});

describe("nextPageEdgeFetch", () => {
  it("targets the first item of the next page with a single-item fetch", () => {
    // page 2, pageSize 10 → next page's first item is overall index 20 →
    // page_size=1 needs backend page 21 to land skip=20
    expect(nextPageEdgeFetch(2, 10)).toEqual({ page: 21, pageSize: 1 });
    expect(nextPageEdgeFetch(1, 50)).toEqual({ page: 51, pageSize: 1 });
  });
});
