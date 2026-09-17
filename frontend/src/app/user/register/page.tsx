"use client";

import { useActionState } from "react";
import AuthPageShell, {
  AuthErrorBanner,
  AuthFootnote,
  AuthLink,
  AuthSubmitButton,
} from "@/components/AuthPageShell";
import AuthField from "@/components/AuthField";
import { register } from "./actions";
import type { RegisterFormState } from "@/types/auth";

const initialState: RegisterFormState = { success: false };

const RegisterPage = () => {
  const [state, formAction, pending] = useActionState(register, initialState);

  return (
    <AuthPageShell
      glyph={<>&#9788;</>}
      title="Begin Your Journey"
      backButtonHref="/"
      backButtonLabel="Portal"
    >
      <AuthErrorBanner message={state.error} className="mb-6" />

      <form action={formAction} className="space-y-6">
        <AuthField
          name="displayName"
          type="text"
          label="Display Name"
          placeholder="Your name (optional)"
          error={state.fieldErrors?.displayName?.[0]}
          autoComplete="name"
        />
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
          autoComplete="new-password"
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

        <AuthSubmitButton pending={pending} pendingLabel="Creating...">
          Create Account
        </AuthSubmitButton>
      </form>

      <AuthFootnote>
        Already have an account?{" "}
        <AuthLink href="/user/login">Enter the Sanctum</AuthLink>
      </AuthFootnote>
    </AuthPageShell>
  );
};

export default RegisterPage;
