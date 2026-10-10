"use server";

import { redirect } from "next/navigation";
import { authenticatedFetch, clearAuthCookies } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/session";
import { deleteAccountSchema } from "@/lib/validation/auth-schemas";
import type { DeleteAccountFormState } from "@/types/auth";

/** Error code the backend sends (403) when the re-entered password is wrong */
const INVALID_PASSWORD = "invalid_password";

/**
 * Self-service account deletion: immediate and irreversible. Identity comes
 * from the session; the password is re-checked by the backend.
 */
export const deleteAccount = async (
  _prevState: DeleteAccountFormState,
  formData: FormData
): Promise<DeleteAccountFormState> => {
  // Deliberately getCurrentUser, not requireConsentedUser: a user who declines
  // new terms must still be able to delete the account
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Session expired. Please log in again." };

  const parsed = deleteAccountSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  console.log("[ACCOUNT] Delete requested", { userId: user.id });
  const result = await authenticatedFetch<void>("/api/v1/auth/me", {
    method: "DELETE",
    body: JSON.stringify({ password: parsed.data.password }),
  });

  if (!result.ok) {
    console.log("[ACCOUNT] Delete failed", { status: result.status, code: result.code });
    if (result.status === 403 && result.code === INVALID_PASSWORD) {
      return { success: false, fieldErrors: { password: ["Incorrect password."] } };
    }
    return { success: false, error: result.message };
  }

  // The backend is bearer-only: the account and its sessions are gone there,
  // and the cookies are ours to clear
  await clearAuthCookies();
  console.log("[ACCOUNT] Account deleted — cookies cleared");
  redirect("/");
};
