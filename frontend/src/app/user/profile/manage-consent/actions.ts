"use server";

import { revalidatePath } from "next/cache";
import { authenticatedFetch } from "@/lib/api-client";
import { consentPayload, tickedDocuments } from "@/lib/consent";
import { CURRENT_VERSIONS } from "@/lib/legal-documents";
import { LEGAL_DOCUMENT_IDS } from "@/lib/legal-versions";
import { getCurrentUser } from "@/lib/session";
import type { ConsentFormState, UserResponse } from "@/types/auth";

// There is no "withdrawn but still has an account" state: the service cannot be
// provided without the Terms. Say so instead of silently ignoring an unticked box.
const NO_WITHDRAWAL =
  "Unticking a box does not withdraw your acceptance. To decline, log out or delete your account.";

/** Re-record acceptance of whichever documents are ticked, at the current
    versions. Available at any time, not only after a version change. */
export const saveConsent = async (
  _prevState: ConsentFormState,
  formData: FormData
): Promise<ConsentFormState> => {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Session expired. Please log in again." };

  const ticked = tickedDocuments(formData);
  if (ticked.length === 0) return { success: false, error: NO_WITHDRAWAL };

  console.log("[CONSENT] Recording consent from profile", { userId: user.id, documents: ticked });
  const result = await authenticatedFetch<UserResponse>("/api/v1/auth/consent", {
    method: "POST",
    body: JSON.stringify(consentPayload(ticked, CURRENT_VERSIONS)),
  });
  if (!result.ok) return { success: false, error: result.message };

  revalidatePath("/user/profile");
  return {
    success: true,
    ...(ticked.length < LEGAL_DOCUMENT_IDS.length && { notice: NO_WITHDRAWAL }),
  };
};
