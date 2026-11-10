"use server";

import { MAJOR_ARCANA_MAX_INDEX } from "@/constants";
import { authenticatedFetch } from "@/lib/api-client";
import { requestPasswordResetEmail } from "@/lib/password-reset";
import { getCurrentUser } from "@/lib/session";
import { contactSupportSchema } from "@/lib/validation/support-schemas";
import type {
  ContactSupportFormState,
  Dashboard,
  DashboardResponse,
  ForgotPasswordFormState,
  MajorArcanaMeaningResponse,
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

  console.log("[AUTH:FORGOT] Dashboard reset-link request", { userId: user.id });
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

  // Deliberately getCurrentUser, not requireConsentedUser: support stays
  // reachable while Terms/Privacy acceptance is stale, because it is also the
  // route for data-access requests — the people most likely to need it are the
  // ones who have not accepted a new version
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

export type MajorArcanaMeaningResult =
  | { ok: true; data: MajorArcanaMeaningResponse }
  | { ok: false; error: string };

/**
 * The card-of-the-day write-up for one major arcana card, by deck index (0 is The
 * Fool). The backend answers 404 until the meanings have been loaded, which the
 * modal shows as a plain sentence rather than an error.
 */
export const getMajorArcanaMeaning = async (index: number): Promise<MajorArcanaMeaningResult> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };
  if (!Number.isInteger(index) || index < 0 || index > MAJOR_ARCANA_MAX_INDEX) {
    return { ok: false, error: "Not a major arcana card." };
  }

  const result = await authenticatedFetch<MajorArcanaMeaningResponse>(
    `/api/v1/cards/major-arcana/${index}`,
    { method: "GET" }
  );
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.status === 404
          ? "This card's meaning has not been written yet."
          : (result.message ?? "The card's meaning could not be reached."),
    };
  }
  return { ok: true, data: result.data };
};
