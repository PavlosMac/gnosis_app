import Link from "next/link";
import { Settings } from "lucide-react";
import BudgetChalice from "@/components/BudgetChalice";
import { chaliceCaption, chaliceFill } from "@/lib/profile-dashboard";

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
  /** null when the ledger could not be fetched */
  budget: { remainingUsd: number; budgetUsd: number } | null;
}

const AccountPanel = ({ name, email, budget }: AccountPanelProps) => {
  // Chalice and caption stand or fall together: a non-finite figure hides both
  // rather than leaving a "$NaN" caption under an empty space
  const usableBudget =
    budget && chaliceFill(budget.remainingUsd, budget.budgetUsd) !== null
      ? budget
      : null;
  const caption = usableBudget ? chaliceCaption(usableBudget.remainingUsd) : null;

  return (
    <div className="flex flex-col p-5 sm:p-8">
      <SectionLabel>Tally</SectionLabel>

      <div className="space-y-4">
        <ProfileRow label="Name" value={name} />
        <ProfileRow label="Email" value={email} />
      </div>

      {/* Oracle budget as a chalice: the fill level is the whole message, no
          currency. It takes the panel's free height and centres in it. */}
      <div className="flex-1 flex flex-col items-center justify-center py-8">
        <span
          className="text-[#d4af37]/70 text-xs tracking-[0.25em] uppercase mb-3"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          Remaining Readings
        </span>
        {usableBudget ? (
          <>
            <BudgetChalice
              remainingUsd={usableBudget.remainingUsd}
              budgetUsd={usableBudget.budgetUsd}
              maxWidth={200}
            />
            {caption && (
              <p
                className="text-[#e6d5b8]/80 text-base mt-3 text-center"
                style={{ fontFamily: "'Crimson Pro', serif" }}
              >
                {caption}
              </p>
            )}
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
        {/* Support, agreements, password reset and deletion live on their own page */}
        <div className="pt-4 border-t border-[#d4af37]/10">
          <Link
            href="/user/profile/settings"
            className="w-full flex items-center justify-between group"
          >
            <span
              className="text-[#e6d5b8]/60 text-sm tracking-wider uppercase group-hover:text-[#d4af37] transition-colors"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Account settings
            </span>
            <span
              className="text-[#d4af37]/40 group-hover:text-[#d4af37] transition-colors"
              aria-hidden="true"
            >
              <Settings size={18} strokeWidth={1.75} />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AccountPanel;
