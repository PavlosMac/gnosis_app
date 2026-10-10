"use server";

import { publicFetch } from "@/lib/api-client";
import { isRegistrationEnabled } from "@/lib/feature-flags";
import { CURRENT_VERSIONS } from "@/lib/legal-documents";
import { WEAK_PASSWORD } from "@/lib/password-policy";
import { registerSchema } from "@/lib/validation/auth-schemas";
import type { DetailResponse, RegisterEchoValues, RegisterFormState } from "@/types/auth";

export const register = async (
  _prevState: RegisterFormState,
  formData: FormData
): Promise<RegisterFormState> => {
  if (!isRegistrationEnabled()) {
    return { success: false, error: "Registration is currently closed." };
  }

  console.log("[AUTH:REGISTER] Register attempt");

  // Echoed back on any failure so the re-rendered form keeps what was typed
  // (React 19 resets uncontrolled inputs after an action). Never the passwords.
  const values: RegisterEchoValues = {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
    acceptTerms: formData.get("acceptTerms") === "on",
    acceptPrivacy: formData.get("acceptPrivacy") === "on",
  };

  const parsed = registerSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    acceptTerms: formData.get("acceptTerms"),
    acceptPrivacy: formData.get("acceptPrivacy"),
  });
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    console.log("[AUTH:REGISTER] Validation failed", { fields: Object.keys(fieldErrors) });
    return { success: false, fieldErrors, values };
  }

  const result = await publicFetch<DetailResponse>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: parsed.data.email,
      password: parsed.data.password,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      // The accepted versions come from the server-side registry, never from
      // the form: a client cannot record acceptance of a version it was not shown
      consents: { terms: CURRENT_VERSIONS.terms, privacy: CURRENT_VERSIONS.privacy },
    }),
  });

  if (!result.ok) {
    console.log("[AUTH:REGISTER] Registration failed", { status: result.status, code: result.code });
    // The backend's blocklist verdict: its message is written for the user
    if (result.code === WEAK_PASSWORD && result.detail) {
      return { success: false, fieldErrors: { password: [result.detail] }, values };
    }
    const error =
      result.status === 409 ? "An account with this email already exists." : result.message;
    return { success: false, error, values };
  }

  // No cookies and no redirect: the account is pending until the emailed link
  // is confirmed, and the user signs in explicitly after that
  console.log("[AUTH:REGISTER] Registration accepted — awaiting email confirmation");
  return { success: true };
};
