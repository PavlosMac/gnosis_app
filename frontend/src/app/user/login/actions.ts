"use server";

import { redirect } from "next/navigation";
import { publicFetch, setAuthCookies } from "@/lib/api-client";
import { loginSchema } from "@/lib/validation/auth-schemas";
import { CURRENT_VERSIONS } from "@/lib/legal-documents";
import { loginFailureState } from "@/lib/login-errors";
import { onboardingRedirect } from "@/lib/onboarding";
import { getCurrentUser } from "@/lib/session";
import { isSafeReturnPath } from "@/lib/auth-return-path";
import type { LoginFormState, TokenResponse } from "@/types/auth";

const authenticateWithCredentials = async (
  formData: FormData
): Promise<LoginFormState> => {
  console.log("[AUTH:LOGIN] Login attempt");

  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    console.log("[AUTH:LOGIN] Validation failed", parsed.error.flatten().fieldErrors);
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await publicFetch<TokenResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });

  if (!result.ok) {
    console.log("[AUTH:LOGIN] Login failed", { status: result.status, code: result.code });
    return loginFailureState(result);
  }

  console.log("[AUTH:LOGIN] Login successful — setting cookies");
  await setAuthCookies(result.data);

  return { success: true };
};

export const login = async (
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> => {
  const result = await authenticateWithCredentials(formData);
  if (!result.success) return result;

  const from = formData.get("from");
  redirect(isSafeReturnPath(from) ? from : "/user/profile");
};

export const loginInline = async (
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> => {
  const result = await authenticateWithCredentials(formData);
  if (!result.success) return result;

  // The inline modal lives on public pages, outside the /user layout gate. A
  // user with an outstanding step (stale Terms/Privacy) would otherwise log in
  // here and then be refused by every guarded action with nowhere to go.
  const user = await getCurrentUser();
  const destination = user ? onboardingRedirect(user, CURRENT_VERSIONS) : null;
  if (destination) redirect(destination);

  return result;
};
