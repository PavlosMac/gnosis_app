"use server";

import { clearAuthCookies, publicFetch } from "@/lib/api-client";
import { resetPasswordSchema } from "@/lib/validation/auth-schemas";
import type { MessageResponse, ResetPasswordFormState } from "@/types/auth";

export const resetPassword = async (
  _prevState: ResetPasswordFormState,
  formData: FormData
): Promise<ResetPasswordFormState> => {
  console.log("[AUTH:RESET] Reset-password attempt");

  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    console.log("[AUTH:RESET] Validation failed", fieldErrors);
    // A blank token can only mean a tampered form — the page never renders the
    // form without one
    if (fieldErrors.token) {
      return { success: false, tokenProblem: "invalid" };
    }
    return { success: false, fieldErrors };
  }

  const result = await publicFetch<MessageResponse>("/api/v1/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({
      token: parsed.data.token,
      new_password: parsed.data.password,
    }),
  });

  if (!result.ok) {
    console.log("[AUTH:RESET] Reset failed", { status: result.status });
    // 400/410 are the token's own verdicts and drive the dead-link panel (the
    // form owns that copy via `tokenProblem`); everything else — including a
    // 422 the zod guard should have made impossible — is a plain error line
    // with the shared SAFE_MESSAGES copy, so we never guess at a field
    switch (result.status) {
      case 400:
        return { success: false, tokenProblem: "invalid" };
      case 410:
        return { success: false, tokenProblem: "expired" };
      default:
        return { success: false, error: result.message };
    }
  }

  // The backend revoked every refresh token and issued nothing new — clear our
  // cookies so this browser is cleanly signed out before the user logs back in
  await clearAuthCookies();
  console.log("[AUTH:RESET] Password reset — cookies cleared");
  return { success: true };
};
