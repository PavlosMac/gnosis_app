"use server";

import { redirect } from "next/navigation";
import { publicFetch, setAuthCookies } from "@/lib/api-client";
import { registerSchema } from "@/lib/validation/auth-schemas";
import type { RegisterFormState, TokenResponse } from "@/types/auth";

export const register = async (
  _prevState: RegisterFormState,
  formData: FormData
): Promise<RegisterFormState> => {
  console.log("[AUTH:REGISTER] Register attempt", { email: formData.get("email") });

  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    displayName: formData.get("displayName") || undefined,
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    console.log("[AUTH:REGISTER] Validation failed", parsed.error.flatten().fieldErrors);
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { confirmPassword: _, ...body } = parsed.data;
  const result = await publicFetch<TokenResponse>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: body.email,
      password: body.password,
      display_name: body.displayName,
    }),
  });

  if (!result.ok) {
    console.log("[AUTH:REGISTER] Registration failed", { error: result.message });
    return { success: false, error: result.message };
  }

  console.log("[AUTH:REGISTER] Registration successful — setting cookies");
  await setAuthCookies(result.data.access_token, result.data.refresh_token);

  redirect("/user/profile");
};
