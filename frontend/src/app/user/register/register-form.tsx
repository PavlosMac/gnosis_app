"use client";

import { useActionState } from "react";
import AuthPageShell, {
  AuthErrorBanner,
  AuthFootnote,
  AuthLink,
  AuthPanelText,
  AuthSubmitButton,
} from "@/components/AuthPageShell";
import AuthField from "@/components/AuthField";
import ConsentCheckbox from "@/components/ConsentCheckbox";
import { PASSWORD_HINT } from "@/lib/password-policy";
import {
  PENDING_ACCOUNT_RETENTION_DAYS,
  VERIFICATION_LINK_TTL_HOURS,
} from "@/lib/verification-policy";
import { register } from "./actions";
import type { RegisterFormState } from "@/types/auth";

interface RegisterFormProps {
  /** Server-rendered current Terms and Conditions */
  terms: React.ReactNode;
  /** Server-rendered current Privacy Policy */
  privacy: React.ReactNode;
}

const initialState: RegisterFormState = { success: false };

const RegisterForm = ({ terms, privacy }: RegisterFormProps) => {
  const [state, formAction, pending] = useActionState(register, initialState);

  return (
    <AuthPageShell
      glyph={<>&#9788;</>}
      title={state.success ? "Check Your Email" : "Begin Your Journey"}
      backButtonHref="/"
      backButtonLabel="Portal"
    >
      {state.success ? (
        <div className="text-center">
          <AuthPanelText>
            We have sent a confirmation link to your email address. Open it to
            confirm your account, then sign in.
          </AuthPanelText>
          <p
            className="text-[#e6d5b8]/50 text-sm"
            style={{ fontFamily: "'Crimson Pro', serif", marginTop: "1rem" }}
          >
            The link expires in {VERIFICATION_LINK_TTL_HOURS} hours. An account
            that is never confirmed is deleted after{" "}
            {PENDING_ACCOUNT_RETENTION_DAYS} days.
          </p>
          <AuthFootnote>
            Didn&rsquo;t get it? <AuthLink href="/verify-email">Resend the link</AuthLink>
          </AuthFootnote>
        </div>
      ) : (
        <>
          <AuthErrorBanner message={state.error} className="mb-6" />

          <form action={formAction} className="space-y-6">
            <AuthField
              name="firstName"
              type="text"
              label="First Name"
              placeholder="Your first name"
              error={state.fieldErrors?.firstName?.[0]}
              autoComplete="given-name"
              maxLength={100}
              defaultValue={state.values?.firstName}
              required
            />
            <AuthField
              name="lastName"
              type="text"
              label="Last Name"
              placeholder="Your last name"
              error={state.fieldErrors?.lastName?.[0]}
              autoComplete="family-name"
              maxLength={100}
              defaultValue={state.values?.lastName}
              required
            />
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
            <AuthField
              name="password"
              type="password"
              label="Password"
              placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
              error={state.fieldErrors?.password?.[0]}
              autoComplete="new-password"
              hint={PASSWORD_HINT}
              required
            />
            <AuthField
              name="confirmPassword"
              type="password"
              label="Confirm Password"
              placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
              error={state.fieldErrors?.confirmPassword?.[0]}
              autoComplete="new-password"
              required
            />

            <div className="space-y-3">
              <ConsentCheckbox
                id="terms"
                document={terms}
                error={state.fieldErrors?.acceptTerms?.[0]}
                defaultChecked={state.values?.acceptTerms}
              />
              <ConsentCheckbox
                id="privacy"
                document={privacy}
                error={state.fieldErrors?.acceptPrivacy?.[0]}
                defaultChecked={state.values?.acceptPrivacy}
              />
            </div>

            <AuthSubmitButton pending={pending} pendingLabel="Creating...">
              Create Account
            </AuthSubmitButton>
          </form>

          <AuthFootnote>
            Already have an account?{" "}
            <AuthLink href="/user/login">Enter the Sanctum</AuthLink>
          </AuthFootnote>
          <AuthFootnote className="mt-3">
            <AuthLink href="/legal/terms">Terms</AuthLink> &middot;{" "}
            <AuthLink href="/legal/privacy">Privacy</AuthLink>
          </AuthFootnote>
        </>
      )}
    </AuthPageShell>
  );
};

export default RegisterForm;
