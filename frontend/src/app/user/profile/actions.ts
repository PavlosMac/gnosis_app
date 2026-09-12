"use server";

import { authenticatedFetch } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/session";
import type { Dashboard, DashboardResponse } from "@/types/auth";
import { mapDashboardResponse } from "@/types/auth";

export type DashboardResult =
  | { ok: true; data: Dashboard }
  | { ok: false; error: string };

/**
 * The profile dashboard in one round trip: account, Oracle budget position,
 * readings count and the newest reading with its interpretation. Failure (older
 * backend without the endpoint, network) is a plain `ok: false` so the page can
 * still render the account panel and links.
 */
export const getDashboard = async (): Promise<DashboardResult> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  const result = await authenticatedFetch<DashboardResponse>("/api/v1/dashboard", {
    method: "GET",
  });

  if (!result.ok)
    return {
      ok: false,
      error: result.message ?? "The oracle's ledger could not be reached.",
    };

  return { ok: true, data: mapDashboardResponse(result.data) };
};
