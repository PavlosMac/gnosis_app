"use server";

import { publicFetch } from "@/lib/api-client";
import { CURRENT_VERSIONS } from "@/lib/legal-documents";
import { WEAK_PASSWORD } from "@/lib/password-policy";
import { acceptInviteSchema } from "@/lib/validation/auth-schemas";
import type {
  AcceptInviteEchoValues,
  AcceptInviteFormState,
  DetailResponse,
} from "@/types/auth";

/** Finish a superadmin invite: name, password and consents against the emailed
    token. Deliberately not gated by REGISTRATION_ENABLED — invites are how
    accounts are created while public sign-up is closed. Sets no cookies: the
    backend issues no tokens here, and the user signs in afterwards. */
export const acceptInvite = async (
  _prevState: AcceptInviteFormState,
  formData: FormData
): Promise<AcceptInviteFormState> => {
  console.log("[AUTH:INVITE] Accept-invite attempt");

  // Echoed back on failure so the re-rendered form keeps what was typed
  // (React 19 resets uncontrolled inputs after an action). Never the passwords.
  const values: AcceptInviteEchoValues = {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    acceptTerms: formData.get("acceptTerms") === "on",
    acceptPrivacy: formData.get("acceptPrivacy") === "on",
  };

  const parsed = acceptInviteSchema.safeParse({
    token: formData.get("token"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    acceptTerms: formData.get("acceptTerms"),
    acceptPrivacy: formData.get("acceptPrivacy"),
  });
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    // A blank token can only mean a tampered form — the page never renders the
    // form without one
    if (fieldErrors.token) return { success: false, tokenProblem: "invalid" };
    console.log("[AUTH:INVITE] Validation failed", { fields: Object.keys(fieldErrors) });
    return { success: false, fieldErrors, values };
  }

  const result = await publicFetch<DetailResponse>("/api/v1/auth/accept-invite", {
    method: "POST",
    body: JSON.stringify({
      token: parsed.data.token,
      password: parsed.data.password,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      // The accepted versions come from the server-side registry, never from
      // the form: a client cannot record acceptance of a version it was not shown
      consents: { terms: CURRENT_VERSIONS.terms, privacy: CURRENT_VERSIONS.privacy },
    }),
  });

  if (!result.ok) {
    console.log("[AUTH:INVITE] Accept failed", { status: result.status, code: result.code });
    if (result.code === WEAK_PASSWORD && result.detail) {
      return { success: false, fieldErrors: { password: [result.detail] }, values };
    }
    switch (result.status) {
      case 400:
        return { success: false, tokenProblem: "invalid" };
      case 410:
        return { success: false, tokenProblem: "expired" };
      default:
        return { success: false, error: result.message, values };
    }
  }

  console.log("[AUTH:INVITE] Invite accepted");
  return { success: true };
};
