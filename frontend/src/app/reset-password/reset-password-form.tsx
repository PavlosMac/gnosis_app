"use client";

import { useActionState } from "react";
import Link from "next/link";
import AuthPageShell, {
  AuthErrorBanner,
  AuthFootnote,
  AuthLink,
  AuthSubmitButton,
} from "@/components/AuthPageShell";
import AuthField from "@/components/AuthField";
import { resetPassword } from "./actions";
import type { ResetPasswordFormState } from "@/types/auth";

interface ResetPasswordFormProps {
  /** From ?token= in the emailed link; undefined renders the dead-link panel */
  token?: string;
}

const initialState: ResetPasswordFormState = { success: false };

const ResetPasswordForm = ({ token }: ResetPasswordFormProps) => {
  const [state, formAction, pending] = useActionState(resetPassword, initialState);

  const deadLink = !token || state.tokenProblem;

  return (
    <AuthPageShell
      glyph={<>&#9765;</>}
      title="New Password"
      backButtonHref="/user/login"
      backButtonLabel="Sanctum"
    >
      {state.success ? (
        <div className="text-center">
          <p
            className="text-[#e6d5b8]/80 text-base"
            style={{ fontFamily: "'Crimson Pro', serif" }}
          >
            Your password has been renewed. All sessions have been signed
            out &mdash; enter with your new words.
          </p>
          <Link
            href="/user/login"
            className="mt-6 block w-full py-3 rounded-lg border border-[#d4af37]/60
                       bg-gradient-to-r from-[#d4af37]/20 via-[#d4af37]/15 to-[#d4af37]/20
                       text-[#d4af37] tracking-widest uppercase text-sm text-center
                       hover:border-[#d4af37] hover:bg-[#d4af37]/30
                       transition-all duration-300"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Enter the Sanctum
          </Link>
        </div>
      ) : deadLink ? (
        <div className="text-center">
          <AuthErrorBanner
            message={
              state.tokenProblem === "expired"
                ? "This link has expired."
                : "This reset link is invalid or has already been used."
            }
          />
          <AuthFootnote>
            <AuthLink href="/forgot-password">Request a new reset link</AuthLink>
          </AuthFootnote>
        </div>
      ) : (
        <>
          {/* Global error (non-token failures) */}
          <AuthErrorBanner message={state.error} className="mb-6" />

          <form action={formAction} className="space-y-6">
            <input type="hidden" name="token" value={token} />
            <AuthField
              name="password"
              type="password"
              label="New Password"
              placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
              error={state.fieldErrors?.password?.[0]}
              autoComplete="new-password"
              required
            />
            <AuthField
              name="confirmPassword"
              type="password"
              label="Confirm New Password"
              placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
              error={state.fieldErrors?.confirmPassword?.[0]}
              autoComplete="new-password"
              required
            />

            <AuthSubmitButton pending={pending} pendingLabel="Resetting...">
              Reset Password
            </AuthSubmitButton>
          </form>
        </>
      )}
    </AuthPageShell>
  );
};

export default ResetPasswordForm;
