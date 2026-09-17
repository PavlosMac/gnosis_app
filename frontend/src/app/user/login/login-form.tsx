"use client";

import { useActionState } from "react";
import AuthPageShell, {
  AuthErrorBanner,
  AuthFootnote,
  AuthLink,
  AuthSubmitButton,
} from "@/components/AuthPageShell";
import AuthField from "@/components/AuthField";
import { login } from "./actions";
import type { LoginFormState } from "@/types/auth";

interface LoginFormProps {
  registrationEnabled: boolean;
  from?: string;
}

const initialState: LoginFormState = { success: false };

const LoginForm = ({ registrationEnabled, from }: LoginFormProps) => {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <AuthPageShell
      glyph={<>&#9789;</>}
      title="Enter the Sanctum"
      backButtonHref="/"
      backButtonLabel="Portal"
    >
      <AuthErrorBanner message={state.error} className="mb-6" />

      <form action={formAction} className="space-y-6">
        {from && <input type="hidden" name="from" value={from} />}
        <AuthField
          name="email"
          type="email"
          label="Email"
          placeholder="your@email.com"
          error={state.fieldErrors?.email?.[0]}
          autoComplete="email"
          required
        />
        <AuthField
          name="password"
          type="password"
          label="Password"
          placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
          error={state.fieldErrors?.password?.[0]}
          autoComplete="current-password"
          required
        />

        <AuthSubmitButton pending={pending} pendingLabel="Entering...">
          Enter
        </AuthSubmitButton>
      </form>

      <AuthFootnote>
        <AuthLink href="/forgot-password">Forgot password?</AuthLink>
      </AuthFootnote>

      {registrationEnabled && (
        <AuthFootnote className="mt-3">
          No account yet?{" "}
          <AuthLink href="/user/register">Begin your journey</AuthLink>
        </AuthFootnote>
      )}
    </AuthPageShell>
  );
};

export default LoginForm;
