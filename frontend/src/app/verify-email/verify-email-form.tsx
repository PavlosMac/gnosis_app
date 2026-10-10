"use client";

import { useActionState } from "react";
import AuthPageShell, {
  AuthButtonLink,
  AuthErrorBanner,
  AuthFootnote,
  AuthLink,
  AuthPanelText,
  AuthSubmitButton,
} from "@/components/AuthPageShell";
import AuthField from "@/components/AuthField";
import { resendVerification, verifyEmail } from "./actions";
import type { ResendVerificationFormState, VerifyEmailFormState } from "@/types/auth";

interface VerifyEmailFormProps {
  /** From ?token= in the emailed link; undefined renders the resend panel */
  token?: string;
}

const verifyInitial: VerifyEmailFormState = { success: false };
const resendInitial: ResendVerificationFormState = { success: false };

const TOKEN_PROBLEM_COPY = {
  expired: "This confirmation link has expired.",
  invalid: "This confirmation link is invalid or has already been used.",
} as const;

/** Ask for a fresh link. The copy after sending is the same whether or not
    the address belongs to a pending account. */
const ResendPanel = () => {
  const [state, formAction, pending] = useActionState(resendVerification, resendInitial);

  if (state.success) {
    return (
      <div className="text-center">
        <AuthPanelText>
          If this account is awaiting confirmation, a new link has been sent.
        </AuthPanelText>
        <AuthFootnote>
          <AuthLink href="/user/login">Return to the Sanctum</AuthLink>
        </AuthFootnote>
      </div>
    );
  }

  return (
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
          defaultValue={state.values?.email}
          required
        />
        <AuthSubmitButton pending={pending} pendingLabel="Sending...">
          Send a New Link
        </AuthSubmitButton>
      </form>
    </>
  );
};

const VerifyEmailForm = ({ token }: VerifyEmailFormProps) => {
  const [state, formAction, pending] = useActionState(verifyEmail, verifyInitial);

  return (
    <AuthPageShell
      glyph={<>&#9993;</>}
      title="Confirm Email"
      backButtonHref="/user/login"
      backButtonLabel="Sanctum"
    >
      {state.success ? (
        <div className="text-center">
          <AuthPanelText>Email confirmed. You can now sign in.</AuthPanelText>
          <AuthButtonLink href="/user/login">Enter the Sanctum</AuthButtonLink>
        </div>
      ) : !token || state.tokenProblem ? (
        <div>
          {state.tokenProblem ? (
            <AuthErrorBanner message={TOKEN_PROBLEM_COPY[state.tokenProblem]} className="mb-6" />
          ) : (
            <p
              className="text-center text-[#e6d5b8]/60 text-sm mb-6"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              Enter your email and we will send a new confirmation link.
            </p>
          )}
          <ResendPanel />
        </div>
      ) : (
        <>
          <AuthErrorBanner message={state.error} className="mb-6" />
          <form action={formAction} className="space-y-6">
            <input type="hidden" name="token" value={token} />
            <p
              className="text-center text-[#e6d5b8]/80 text-base"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              Confirm that this email address is yours to finish creating your
              account.
            </p>
            <AuthSubmitButton pending={pending} pendingLabel="Confirming...">
              Confirm Email
            </AuthSubmitButton>
          </form>
        </>
      )}
    </AuthPageShell>
  );
};

export default VerifyEmailForm;
