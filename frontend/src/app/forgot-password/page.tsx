"use client";

import { useActionState } from "react";
import AuthPageShell, {
  AuthErrorBanner,
  AuthFootnote,
  AuthLink,
  AuthSubmitButton,
} from "@/components/AuthPageShell";
import AuthField from "@/components/AuthField";
import { requestPasswordReset } from "./actions";
import type { ForgotPasswordFormState } from "@/types/auth";

const initialState: ForgotPasswordFormState = { success: false };

const ForgotPasswordPage = () => {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <AuthPageShell
      glyph={<>&#9790;</>}
      title="Password Reset"
      backButtonHref="/user/login"
      backButtonLabel="Sanctum"
    >
      {state.success ? (
        <div className="text-center">
          <p
            className="text-[#e6d5b8]/80 text-base"
            style={{ fontFamily: "'Crimson Pro', serif" }}
          >
            If an account exists for this email, a password reset link has
            been sent.
          </p>
          <AuthFootnote>
            <AuthLink href="/user/login">Return to the Sanctum</AuthLink>
          </AuthFootnote>
        </div>
      ) : (
        <>
          <AuthErrorBanner message={state.error} className="mb-6" />

          <form action={formAction} className="space-y-6">
            <AuthField
              name="email"
              type="email"
              label="Email"
              placeholder="your@email.com"
              error={state.fieldErrors?.email?.[0]}
              autoComplete="email"
              required
            />

            <AuthSubmitButton pending={pending} pendingLabel="Sending...">
              Send Reset Link
            </AuthSubmitButton>
          </form>

          <AuthFootnote>
            Remembered?{" "}
            <AuthLink href="/user/login">Login</AuthLink>
          </AuthFootnote>
        </>
      )}
    </AuthPageShell>
  );
};

export default ForgotPasswordPage;
