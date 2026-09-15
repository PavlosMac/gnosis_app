"use server";

import { requestPasswordResetEmail } from "@/lib/password-reset";
import { forgotPasswordSchema } from "@/lib/validation/auth-schemas";
import type { ForgotPasswordFormState } from "@/types/auth";

export const requestPasswordReset = async (
  _prevState: ForgotPasswordFormState,
  formData: FormData
): Promise<ForgotPasswordFormState> => {
  console.log("[AUTH:FORGOT] Forgot-password request", { email: formData.get("email") });

  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    console.log("[AUTH:FORGOT] Validation failed", parsed.error.flatten().fieldErrors);
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  return requestPasswordResetEmail(parsed.data.email);
};
