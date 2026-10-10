"use server";

import { publicFetch } from "@/lib/api-client";
import { requestVerificationEmail } from "@/lib/email-verification";
import {
  resendVerificationSchema,
  verifyEmailSchema,
} from "@/lib/validation/auth-schemas";
import type {
  DetailResponse,
  ResendVerificationFormState,
  VerifyEmailFormState,
} from "@/types/auth";

/** Confirm the emailed token. Sets no cookies: the backend issues no tokens
    here, and the user signs in explicitly afterwards. */
export const verifyEmail = async (
  _prevState: VerifyEmailFormState,
  formData: FormData
): Promise<VerifyEmailFormState> => {
  console.log("[AUTH:VERIFY] Verify-email attempt");

  const parsed = verifyEmailSchema.safeParse({ token: formData.get("token") });
  // A blank token can only mean a tampered form — the page never renders the
  // Confirm button without one
  if (!parsed.success) return { success: false, tokenProblem: "invalid" };

  const result = await publicFetch<DetailResponse>("/api/v1/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token: parsed.data.token }),
  });

  if (!result.ok) {
    console.log("[AUTH:VERIFY] Verification failed", { status: result.status });
    // 400/410 are the token's own verdicts and drive the dead-link panel;
    // anything else is a plain error line with the shared SAFE_MESSAGES copy
    switch (result.status) {
      case 400:
        return { success: false, tokenProblem: "invalid" };
      case 410:
        return { success: false, tokenProblem: "expired" };
      default:
        return { success: false, error: result.message };
    }
  }

  console.log("[AUTH:VERIFY] Email confirmed");
  return { success: true };
};

export const resendVerification = async (
  _prevState: ResendVerificationFormState,
  formData: FormData
): Promise<ResendVerificationFormState> => {
  const email = String(formData.get("email") ?? "");
  const parsed = resendVerificationSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      values: { email },
    };
  }

  return requestVerificationEmail(parsed.data.email);
};
