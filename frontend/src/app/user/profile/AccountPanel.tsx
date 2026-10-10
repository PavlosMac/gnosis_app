import Link from "next/link";
import BudgetChalice from "@/components/BudgetChalice";
import AgreementRows from "./AgreementRows";
import ContactSupportRow from "./ContactSupportRow";
import ResetPasswordRequestButton from "./ResetPasswordRequestButton";
import { budgetCaption, chaliceFill } from "@/lib/profile-dashboard";
import type { UserConsents } from "@/lib/consent";

export const ProfileRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4">
    <span
      className="text-[#e6d5b8]/60 text-sm tracking-wider uppercase shrink-0"
      style={{ fontFamily: "'Cinzel', serif" }}
    >
      {label}
    </span>
    {/* minWidth 0 lets a flex child shrink below its nowrap text so `truncate` can ellipsize */}
    <span
      className="text-[#e6d5b8] text-sm truncate text-right"
      style={{ fontFamily: "'Crimson Pro', serif", minWidth: 0 }}
      title={value}
    >
      {value}
    </span>
  </div>
);

export const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h2
    className="text-[#d4af37]/80 text-xs tracking-[0.3em] uppercase text-center mb-6"
    style={{ fontFamily: "'Cinzel', serif" }}
  >
    ✦ {children} ✦
  </h2>
);

interface AccountPanelProps {
  /** Already resolved: display name, else first + last, else "Seeker" */
  name: string;
  email: string;
  consents: UserConsents | undefined;
  /** null when the ledger could not be fetched */
  budget: { remainingUsd: number; budgetUsd: number } | null;
}

const AccountPanel = ({ name, email, consents, budget }: AccountPanelProps) => {
  // Chalice and caption stand or fall together: a non-finite figure hides both
  // rather than leaving a "$NaN" caption under an empty space
  const usableBudget =
    budget && chaliceFill(budget.remainingUsd, budget.budgetUsd) !== null
      ? budget
      : null;

  return (
    <div className="flex flex-col p-5 sm:p-8">
      <SectionLabel>Tally</SectionLabel>

      <div className="space-y-4">
        <ProfileRow label="Name" value={name} />
        <ProfileRow label="Email" value={email} />
      </div>

      {/* Oracle budget as a chalice */}
      <div className="flex flex-col items-center py-8">
        <span
          className="text-[#d4af37]/70 text-xs tracking-[0.25em] uppercase mb-3"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          Oracle Chalice
        </span>
        {usableBudget ? (
          <>
            <BudgetChalice
              remainingUsd={usableBudget.remainingUsd}
              budgetUsd={usableBudget.budgetUsd}
            />
            <p
              className="text-[#e6d5b8]/80 text-base mt-3 text-center"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              {budgetCaption(usableBudget.remainingUsd, usableBudget.budgetUsd)}
            </p>
          </>
        ) : (
          <p
            className="text-[#e6d5b8]/40 text-sm italic text-center"
            style={{ fontFamily: "'Crimson Pro', serif" }}
          >
            The oracle&rsquo;s ledger is unavailable
          </p>
        )}
      </div>

      <div style={{ marginTop: "auto" }}>
        <AgreementRows consents={consents} />
        <ContactSupportRow />
        <div className="pt-4 mt-4 border-t border-[#d4af37]/10">
          <ResetPasswordRequestButton />
        </div>
        {/* Danger zone: set apart from the rows above by its own rule and colour */}
        <div
          className="border-t border-red-400/20 text-center"
          style={{ marginTop: "1.5rem", paddingTop: "1rem" }}
        >
          <Link
            href="/user/profile/delete-account"
            className="text-red-400/60 hover:text-red-400 text-xs tracking-widest uppercase transition-colors"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Delete account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AccountPanel;
