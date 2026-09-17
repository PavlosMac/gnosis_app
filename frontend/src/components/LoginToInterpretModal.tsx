"use client";

import { useActionState, useEffect } from "react";
import SanctumModal from "@/components/SanctumModal";
import AuthField from "@/components/AuthField";
import { AuthErrorBanner, AuthSubmitButton } from "@/components/AuthPageShell";
import { loginInline } from "@/app/user/login/actions";
import type { LoginFormState } from "@/types/auth";

interface LoginToInterpretModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const initialState: LoginFormState = { success: false };

const LoginToInterpretModal = ({ onClose, onSuccess }: LoginToInterpretModalProps) => {
  const [state, formAction, pending] = useActionState(loginInline, initialState);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <SanctumModal title="Enter the Sanctum" onClose={onClose}>
      <p
        className="text-center text-[#e6d5b8]/60 text-sm mb-6"
        style={{ fontFamily: "'Crimson Pro', serif" }}
      >
        Login to reveal the Oracle&apos;s interpretation of your reading.
      </p>

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
        <AuthField
          name="password"
          type="password"
          label="Password"
          placeholder="••••••••"
          error={state.fieldErrors?.password?.[0]}
          autoComplete="current-password"
          required
        />

        <AuthSubmitButton pending={pending} pendingLabel="Entering...">
          Enter
        </AuthSubmitButton>
      </form>
    </SanctumModal>
  );
};

export default LoginToInterpretModal;
