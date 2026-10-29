import Link from "next/link";
import { Settings } from "lucide-react";

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
  // `budget` is kept on the props (and the dashboard still fetches it) for the tarot card
  // visual that will take the slot below; nothing reads it yet.
  void budget;

  return (
    <div className="flex flex-col p-5 sm:p-8">
      <SectionLabel>Tally</SectionLabel>

      <div className="space-y-4">
        <ProfileRow label="Name" value={name} />
        <ProfileRow label="Email" value={email} />
      </div>

      {/* Reserved for a tarot card visual. The budget chalice that stood here was five
          infinite SVG animations under a drop-shadow filter; the slot keeps its size so
          the two-panel layout does not shift when the card arrives. */}
      <div className="flex-1 flex flex-col items-center justify-center py-8">
        <div
          aria-hidden="true"
          data-testid="tally-card-slot"
          className="aspect-[2/3] w-full max-w-[200px] rounded-xl border border-[#d4af37]/10"
        />
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
