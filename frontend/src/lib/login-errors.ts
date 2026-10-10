import type { ApiError } from "@/types/api";
import type { LoginFormState } from "@/types/auth";

/** Error code the backend sends with a 403 for an account that has not
    confirmed its email yet */
export const EMAIL_NOT_VERIFIED = "email_not_verified";

/** Turn a failed POST /auth/login into the form state both login forms render */
export const loginFailureState = (result: ApiError): LoginFormState => {
  if (result.status === 403 && result.code === EMAIL_NOT_VERIFIED) {
    return {
      success: false,
      error: "Please confirm your email address before signing in. Check your inbox for the link.",
      emailNotVerified: true,
    };
  }
  // On the login endpoint 401 means bad credentials, not an expired session —
  // override the generic SAFE_MESSAGES mapping
  if (result.status === 401) return { success: false, error: "Incorrect email or password." };
  return { success: false, error: result.message };
};
