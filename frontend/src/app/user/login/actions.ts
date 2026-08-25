"use server";

import { redirect } from "next/navigation";
import { publicFetch, setAuthCookies } from "@/lib/api-client";
import { loginSchema } from "@/lib/validation/auth-schemas";
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
    console.log("[AUTH:LOGIN] Login failed", { error: result.message });
    return { success: false, error: result.message };
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
  return authenticateWithCredentials(formData);
};
