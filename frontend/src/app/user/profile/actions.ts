"use server";

import { authenticatedFetch } from "@/lib/api-client";
import { requestPasswordResetEmail } from "@/lib/password-reset";
import { getCurrentUser } from "@/lib/session";
import { contactSupportSchema } from "@/lib/validation/support-schemas";
import type {
  ContactSupportFormState,
  Dashboard,
  DashboardResponse,
  ForgotPasswordFormState,
  MessageResponse,
} from "@/types/auth";
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

/**
 * One-click "send me a password reset link" from the dashboard. The email
 * always comes from the server-side session, never from the client — server
 * actions are directly invokable, so trusting a submitted email would let
 * anyone relay reset requests to arbitrary addresses through us.
 */
export const requestPasswordResetForCurrentUser = async (
  _prevState: ForgotPasswordFormState,
  _formData: FormData
): Promise<ForgotPasswordFormState> => {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Session expired. Please log in again." };
  }

  console.log("[AUTH:FORGOT] Dashboard reset-link request", { email: user.email });
  return requestPasswordResetEmail(user.email);
};

/**
 * Contact-support ticket: only {subject, message} crosses the wire — the
 * backend resolves the requester's email and user_id from the JWT itself,
 * for the same reason the reset action above never trusts a submitted email.
 */
export const contactSupport = async (
  _prevState: ContactSupportFormState,
  formData: FormData
): Promise<ContactSupportFormState> => {
  // Echoed back on any failure so the re-rendered form keeps what was typed
  const values = {
    subject: String(formData.get("subject") ?? ""),
    message: String(formData.get("message") ?? ""),
  };

  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Session expired. Please log in again.", values };
  }

  const parsed = contactSupportSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  console.log("[SUPPORT] Contact request", { userId: user.id });
  const result = await authenticatedFetch<MessageResponse>("/api/v1/support/contact", {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });
  if (!result.ok) return { success: false, error: result.message, values };
  return { success: true };
};
