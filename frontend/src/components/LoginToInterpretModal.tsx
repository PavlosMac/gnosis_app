"use client";

import React, { useActionState, useEffect } from "react";
import { createPortal } from "react-dom";
import OrnateFrame from "@/components/OrnateFrame";
import AuthField from "@/components/AuthField";
import { loginInline } from "@/app/user/login/actions";
import type { LoginFormState } from "@/types/auth";

interface LoginToInterpretModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const initialState: LoginFormState = { success: false };

const LoginToInterpretModal: React.FC<LoginToInterpretModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const [state, formAction, pending] = useActionState(loginInline, initialState);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  useEffect(() => {
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center isolate"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm z-0"
        onClick={onClose}
      />

      <div
        className="relative z-10 w-full mx-4 my-8 max-w-md rounded-xl border-2 border-[#d4af37]/40 shadow-2xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(26,0,51,0.97) 0%, rgba(45,27,78,0.97) 100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <OrnateFrame size="sm" corners="top" />

        <div
          className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-[#d4af37]/20"
          style={{
            background:
              "linear-gradient(135deg, rgba(26,0,51,0.98) 0%, rgba(45,27,78,0.98) 100%)",
          }}
        >
          <h2
            className="text-xl sm:text-2xl font-bold text-[#d4af37] tracking-wider"
            style={{
              fontFamily: "'Cinzel', serif",
              textShadow: "0 0 15px rgba(212,175,55,0.4)",
            }}
          >
            ✦ Enter the Sanctum ✦
          </h2>
          <button
            onClick={onClose}
            className="shrink-0 text-[#d4af37]/60 hover:text-[#d4af37] transition-colors text-2xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          <p
            className="text-center text-[#e6d5b8]/60 text-sm mb-6"
            style={{ fontFamily: "'Crimson Pro', serif" }}
          >
            Login to reveal the Oracle&apos;s interpretation of your reading.
          </p>

          {state.error && (
            <p
              className="mb-6 text-center text-sm text-red-400/90 border border-red-400/20 rounded-lg px-4 py-3 bg-red-400/5"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              {state.error}
            </p>
          )}

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

            <button
              type="submit"
              disabled={pending}
              className="w-full py-3 rounded-lg border border-[#d4af37]/60
                         bg-gradient-to-r from-[#d4af37]/20 via-[#d4af37]/15 to-[#d4af37]/20
                         text-[#d4af37] tracking-widest uppercase text-sm
                         hover:border-[#d4af37] hover:bg-[#d4af37]/30
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-300"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              {pending ? "Entering..." : "Enter"}
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LoginToInterpretModal;
