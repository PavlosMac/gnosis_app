"use client";

import { useActionState } from "react";
import Link from "next/link";
import TarotPageLayout from "@/components/TarotPageLayout";
import AuthField from "@/components/AuthField";
import { register } from "./actions";
import type { RegisterFormState } from "@/types/auth";

const initialState: RegisterFormState = { success: false };

const RegisterPage = () => {
  const [state, formAction, pending] = useActionState(register, initialState);

  return (
    <TarotPageLayout backButtonHref="/" backButtonLabel="Portal">
      <div className="w-full max-w-md mx-auto mt-8 sm:mt-16 px-4 sm:px-0">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="text-4xl text-[#d4af37]/80">&#9788;</span>
          <h1
            className="text-3xl text-[#d4af37] tracking-[0.2em] mt-4"
            style={{
              fontFamily: "'Cinzel', serif",
              textShadow: "0 0 30px rgba(212,175,55,0.4)",
            }}
          >
            Begin Your Journey
          </h1>
          <div className="flex items-center justify-center gap-3 mt-3">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#d4af37]/40" />
            <span className="text-[#d4af37]/60 text-sm">&#9765;</span>
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-[#d4af37]/40" />
          </div>
        </div>

        {/* Card container */}
        <div className="relative rounded-2xl border border-[#d4af37]/20 bg-gradient-to-b from-[#1a0033]/80 to-[#0a0015]/80 backdrop-blur-sm p-5 sm:p-8">
          {/* Global error */}
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
              {pending ? "Creating..." : "Create Account"}
            </button>
          </form>

          <p
            className="mt-6 text-center text-[#e6d5b8]/50 text-sm"
            style={{ fontFamily: "'Crimson Pro', serif" }}
          >
            Already have an account?{" "}
            <Link
              href="/user/login"
              className="text-[#d4af37]/70 hover:text-[#d4af37] transition-colors underline-offset-4 hover:underline"
            >
              Enter the Sanctum
            </Link>
          </p>
        </div>
      </div>
    </TarotPageLayout>
  );
};

export default RegisterPage;
