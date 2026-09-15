"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { requestPasswordResetForCurrentUser } from "./actions";
import type { ForgotPasswordFormState } from "@/types/auth";

const initialState: ForgotPasswordFormState = { success: false };

/**
 * One-click password-reset request for the logged-in user. On success the
 * button gives way to a confirmation — one shot per page view, so an eager
 * hand doesn't summon the rate limiter.
 */
const ResetPasswordRequestButton = () => {
  const [state, formAction, pending] = useActionState(
    requestPasswordResetForCurrentUser,
    initialState
  );

  if (state.success) {
    return (
      <p
        className="text-center text-[#e6d5b8]/60 text-sm py-2"
        style={{ fontFamily: "'Crimson Pro', serif" }}
      >
        A reset link has been sent to your email.
      </p>
    );
  }

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={pending}
        aria-label="Send a password reset link to your email"
        className="w-full py-2 rounded-lg border border-[#d4af37]/20 text-[#d4af37]/50
                   hover:border-[#d4af37]/40 hover:text-[#d4af37]/80
                   disabled:opacity-50 disabled:cursor-not-allowed
                   text-sm tracking-widest uppercase transition-all duration-300
                   inline-flex items-center justify-center gap-2"
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        <KeyRound size={16} strokeWidth={1.75} aria-hidden="true" />
        {pending ? "Dispatching..." : "Reset Password"}
      </button>
      {state.error && (
        <p
          className="mt-2 text-center text-red-400/90 text-sm"
          style={{ fontFamily: "'Crimson Pro', serif" }}
        >
          {state.error}
        </p>
      )}
    </form>
  );
};

export default ResetPasswordRequestButton;
