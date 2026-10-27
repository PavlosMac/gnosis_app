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
import ConsentCheckbox from "@/components/ConsentCheckbox";
import { PASSWORD_HINT } from "@/lib/password-policy";
import { acceptInvite } from "./actions";
import type { AcceptInviteFormState } from "@/types/auth";

export type InviteProblem = "invalid" | "expired" | "unavailable";

interface AcceptInviteFormProps {
  /** From ?token= in the emailed link */
  token?: string;
  /** The address the invite is for, from the server-side lookup */
  email?: string;
  /** Set by the page when the link cannot be used; renders the dead-link panel */
  problem?: InviteProblem;
  /** Server-rendered current Terms and Conditions */
  terms: React.ReactNode;
  /** Server-rendered current Privacy Policy */
  privacy: React.ReactNode;
}

const initialState: AcceptInviteFormState = { success: false };

const PROBLEM_COPY: Record<InviteProblem, string> = {
  expired: "This invitation link has expired. Ask for a new one.",
  invalid: "This invitation link is invalid or has already been used.",
  unavailable: "The sanctum is unreachable right now. Please try the link again later.",
};

const AcceptInviteForm = ({ token, email, problem, terms, privacy }: AcceptInviteFormProps) => {
  const [state, formAction, pending] = useActionState(acceptInvite, initialState);
  const deadLink = problem ?? state.tokenProblem;

  return (
    <AuthPageShell
      glyph={<>&#10048;</>}
      title={state.success ? "Welcome" : "You Are Invited"}
      backButtonHref="/"
      backButtonLabel="Portal"
    >
      {state.success ? (
        <div className="text-center">
          <AuthPanelText>Your account is ready. Sign in to begin.</AuthPanelText>
          <AuthButtonLink href="/user/login">Enter the Sanctum</AuthButtonLink>
        </div>
      ) : deadLink || !token ? (
        <div className="text-center">
          <AuthErrorBanner message={PROBLEM_COPY[deadLink ?? "invalid"]} />
          <AuthFootnote>
            Already have an account? <AuthLink href="/user/login">Enter the Sanctum</AuthLink>
          </AuthFootnote>
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
              Invitation for <span className="text-[#d4af37]">{email}</span>
            </p>
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

          <AuthFootnote className="mt-3">
            <AuthLink href="/legal/terms">Terms</AuthLink> &middot;{" "}
            <AuthLink href="/legal/privacy">Privacy</AuthLink>
          </AuthFootnote>
        </>
      )}
    </AuthPageShell>
  );
};

export default AcceptInviteForm;
