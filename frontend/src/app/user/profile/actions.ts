"use server";

import { cache } from "react";
import { authenticatedFetch } from "@/lib/api-client";
import type { User, MeResponse } from "@/types/auth";
import { mapMeResponseToUser } from "@/types/auth";

export const getCurrentUser = cache(async (): Promise<User | null> => {
  console.log("[AUTH:SESSION] Fetching current user");
  const result = await authenticatedFetch<MeResponse>("/api/v1/auth/me", {
    method: "GET",
  });

  if (!result.ok) {
    console.log("[AUTH:SESSION] No authenticated user", { status: result.status });
    return null;
  }

  console.log("[AUTH:SESSION] User loaded", { id: result.data._id });
  return mapMeResponseToUser(result.data);
});
