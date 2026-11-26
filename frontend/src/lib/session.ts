"use server";

import { cache } from "react";
import { authenticatedFetch } from "@/lib/api-client";
import type { ApiResult } from "@/types/api";
import type { User, MeResponse } from "@/types/auth";
import { mapMeResponseToUser } from "@/types/auth";
import { CURRENT_VERSIONS } from "@/lib/legal-documents";
import { onboardingRedirect } from "@/lib/onboarding";

// One /auth/me call per request, shared by every reader below (React cache).
// Not exported: this is a "use server" module, and an export would be callable
// from the browser.
const fetchMe = cache(
  async (): Promise<ApiResult<MeResponse>> =>
    authenticatedFetch<MeResponse>("/api/v1/auth/me", { method: "GET" })
);

export const getCurrentUser = async (): Promise<User | null> => {
  console.log("[AUTH:SESSION] Fetching current user");
  const result = await fetchMe();

  if (!result.ok) {
    console.log("[AUTH:SESSION] No authenticated user", { status: result.status });
    return null;
  }

  console.log("[AUTH:SESSION] User loaded", { id: result.data._id });
  return mapMeResponseToUser(result.data);
};

/**
 * Why `requireConsentedUser()` said no, for actions whose error copy must not
 * tell a logged-in user to log in: "onboarding" when a session exists but a step
 * is outstanding, "unauthenticated" when the session is gone (a 401), and
 * "unavailable" when the backend could not say (an outage is not a logout).
 */
export const consentRefusalReason = async (): Promise<
  "onboarding" | "unauthenticated" | "unavailable"
> => {
  const result = await fetchMe();
  if (result.ok) return "onboarding";
  return result.unauthenticated ? "unauthenticated" : "unavailable";
};

/**
 * The current user, but only if nothing in onboarding is outstanding (email
 * confirmed, current Terms and Privacy accepted). Layouts do not protect server
 * actions, so every data-creating action calls this instead of
 * `getCurrentUser()`; a null reads as "not authenticated" and the next full
 * render hits the layout's redirect to the outstanding step. The /auth/me
 * answer is request-cached, so this costs no extra request.
 */
export const requireConsentedUser = async (): Promise<User | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  return onboardingRedirect(user, CURRENT_VERSIONS) === null ? user : null;
};
