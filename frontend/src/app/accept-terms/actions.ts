"use server";

import { redirect } from "next/navigation";
import { authenticatedFetch } from "@/lib/api-client";
import { consentPayload, staleConsents, tickedDocuments } from "@/lib/consent";
import { CURRENT_VERSIONS } from "@/lib/legal-documents";
import { CONSENT_FIELDS, DOCUMENT_TITLES } from "@/lib/legal-versions";
import { getCurrentUser } from "@/lib/session";
import type { ConsentFormState, UserResponse } from "@/types/auth";

/** Record acceptance of every document whose version moved on. Identity comes
    from the session, versions from the server-side registry. */
export const acceptTerms = async (
  _prevState: ConsentFormState,
  formData: FormData
): Promise<ConsentFormState> => {
  // Deliberately getCurrentUser, not requireConsentedUser: this is the action
  // a user with stale consents must be able to call
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Session expired. Please log in again." };

  const stale = staleConsents(user.consents, CURRENT_VERSIONS);
  const ticked = tickedDocuments(formData);
  const missing = stale.filter((id) => !ticked.includes(id));
  if (missing.length > 0) {
    return {
      success: false,
      fieldErrors: Object.fromEntries(
        missing.map((id) => [
          CONSENT_FIELDS[id],
          [`You must accept the ${DOCUMENT_TITLES[id]} to continue`],
        ])
      ),
    };
  }

  if (stale.length > 0) {
    console.log("[CONSENT] Recording re-consent", { userId: user.id, documents: stale });
    const result = await authenticatedFetch<UserResponse>("/api/v1/auth/consent", {
      method: "POST",
      body: JSON.stringify(consentPayload(stale, CURRENT_VERSIONS)),
    });
    if (!result.ok) return { success: false, error: result.message };
  }

  redirect("/user/profile");
};
