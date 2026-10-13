"use client";

import Link from "next/link";
import SanctumModal from "@/components/SanctumModal";
import { AuthButton, AuthButtonLink, AuthFootnote } from "@/components/AuthPageShell";
import { useAuth } from "@/app/providers/auth-provider";
import type { FreeTrialKind } from "@/lib/free-trials";

/*
 * The sign-up nudge shown to a visitor without a session once the free uses
 * in this browser are spent (see lib/free-trials.ts). It replaces the next
 * attempt, never interrupts one in progress, and leaves what is already on
 * screen untouched. Login goes through the caller's existing login modal.
 */

interface FreeLimitPanelProps {
  variant: FreeTrialKind;
  onClose: () => void;
  /** Open the login modal in place of this panel */
  onLogin: () => void;
}

const COPY: Record<FreeTrialKind, { title: string; body: string }> = {
  reading: {
    title: "The Oracle Awaits",
    body: "Register to keep reading, save your spreads and ask the Oracle for an interpretation.",
  },
  significators: {
    title: "The Oracle Awaits",
    body: "Create an account to chart as many birth dates as you wish.",
  },
};

const OFFERINGS = [
  "The Reading Oracle, with 8 spreads and the Significators chart calculator",
  "A Readings Journal with tags and filtering",
  "Oracle interpretations written by a large language model (including the Significators chart)",
  "User login and account settings",
];

const SECONDARY_BUTTON_CLASS =
  "text-[#d4af37]/70 hover:text-[#d4af37] transition-colors underline-offset-4 hover:underline";

const FreeLimitPanel = ({ variant, onClose, onLogin }: FreeLimitPanelProps) => {
  const { registrationEnabled } = useAuth();
  const { title, body } = COPY[variant];

  return (
    <SanctumModal title={title} onClose={onClose}>
      <p
        className="text-center text-[#e6d5b8]/80 text-base leading-relaxed"
        style={{ fontFamily: "'Crimson Pro', serif" }}
      >
        {body}
      </p>

      <div className="mt-5 text-[#e6d5b8]/70 text-sm" style={{ fontFamily: "'Crimson Pro', serif" }}>
        <h3 className="text-[#d4af37]/80 tracking-widest uppercase text-xs mb-2" style={{ fontFamily: "'Cinzel', serif" }}>
          What you get
        </h3>
        <ul className="list-disc pl-5 space-y-1">
          {OFFERINGS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <Link href="/about" className={`${SECONDARY_BUTTON_CLASS} inline-block mt-3`}>
          Read more
        </Link>
      </div>

      {registrationEnabled ? (
        <>
          <AuthButtonLink href="/user/register">Begin your journey</AuthButtonLink>
          <AuthFootnote>
            Already have an account?{" "}
            <button type="button" onClick={onLogin} className={SECONDARY_BUTTON_CLASS}>
              Enter the Sanctum
            </button>
          </AuthFootnote>
        </>
      ) : (
        <AuthButton onClick={onLogin}>Enter the Sanctum</AuthButton>
      )}
    </SanctumModal>
  );
};

export default FreeLimitPanel;
