import { publicFetch } from "@/lib/api-client";
import type { DetailResponse, ResendVerificationFormState } from "@/types/auth";

/**
 * Ask the backend to send a fresh email-confirmation link. Mirror of
 * `password-reset.ts`: the endpoint answers 200 whether the account is
 * unknown, already confirmed or pending, so success here never reveals which.
 * 429 is its only defined error; it and server-health failures surface through
 * the shared `SAFE_MESSAGES` copy.
 */
export const requestVerificationEmail = async (
  email: string
): Promise<ResendVerificationFormState> => {
  const result = await publicFetch<DetailResponse>("/api/v1/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

  if (!result.ok) {
    console.log("[AUTH:VERIFY] Resend failed", { status: result.status });
    return { success: false, error: result.message, values: { email } };
  }

  console.log("[AUTH:VERIFY] Verification link requested");
  return { success: true };
};
