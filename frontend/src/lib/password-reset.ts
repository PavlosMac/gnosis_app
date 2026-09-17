import { publicFetch } from "@/lib/api-client";
import type { ForgotPasswordFormState, MessageResponse } from "@/types/auth";

/**
 * Ask the backend to email a password-reset link. Shared by the public
 * /forgot-password form and the dashboard's one-click button so the two flows
 * can't drift. The endpoint always answers 200 whether or not the account
 * exists; 429 is its only defined error and anything else is server health —
 * neither reveals account existence, and both surface through the shared
 * `SAFE_MESSAGES` copy in `result.message`.
 */
export const requestPasswordResetEmail = async (
  email: string
): Promise<ForgotPasswordFormState> => {
  const result = await publicFetch<MessageResponse>("/api/v1/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

  if (!result.ok) {
    console.log("[AUTH:FORGOT] Request failed", { status: result.status });
    return { success: false, error: result.message };
  }

  console.log("[AUTH:FORGOT] Reset link requested");
  return { success: true };
};
