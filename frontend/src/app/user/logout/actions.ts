"use server";

import { redirect } from "next/navigation";
import { authenticatedFetch, clearAuthCookies } from "@/lib/api-client";

export const logout = async (): Promise<void> => {
  console.log("[AUTH:LOGOUT] Logout initiated");

  // Best-effort: tell FastAPI to revoke the token
  try {
    await authenticatedFetch("/api/v1/auth/logout", { method: "POST" });
  } catch {
    console.log("[AUTH:LOGOUT] FastAPI revoke threw (best-effort)");
  }

  await clearAuthCookies();
  console.log("[AUTH:LOGOUT] Logout complete — redirecting to login");

  redirect("/user/login");
};
