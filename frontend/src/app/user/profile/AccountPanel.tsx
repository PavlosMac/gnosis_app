import Link from "next/link";
import { Settings } from "lucide-react";
import TallyCard from "./TallyCard";

interface AccountPanelProps {
  /** Already resolved: first name, else "Seeker" */
  name: string;
  /** ISO "YYYY-MM-DD"; null for accounts created before it was required */
  birthDate: string | null;
}

const AccountPanel = ({ name, birthDate }: AccountPanelProps) => {
  return (
    <section aria-label="Your account" className="flex flex-col p-5 sm:p-8">
      {/* The seeker's first name, set like a title: no label, no email */}
      <div className="text-center">
        <p
          className="text-2xl text-[#e6d5b8] tracking-[0.15em] truncate"
          style={{
            fontFamily: "'Cinzel', serif",
            textShadow: "0 0 20px rgba(212,175,55,0.25)",
          }}
          title={name}
        >
          {name}
        </p>
        <div className="flex items-center justify-center gap-2 mt-3" aria-hidden="true">
          <div className="w-8 h-px bg-gradient-to-r from-transparent to-[#d4af37]/40" />
          <span className="text-[#d4af37]/50 text-xs">✦</span>
          <div className="w-8 h-px bg-gradient-to-l from-transparent to-[#d4af37]/40" />
        </div>
      </div>

      {/* The personal day card, drawn client-side from the account birth date and the
          user's local date. Until then (and for accounts without a date) it is the empty
          card-proportioned frame, so the two-panel layout never shifts. */}
      <div className="flex-1 flex flex-col items-center justify-center py-8">
        <TallyCard birthDate={birthDate} />
      </div>

      <div style={{ marginTop: "auto" }}>
        {/* Support, agreements, password reset and deletion live on their own page */}
        <div className="pt-4 border-t border-[#d4af37]/10">
          <Link
            href="/user/profile/settings"
            className="w-full flex items-center justify-center gap-2 group"
          >
            <span
              className="text-[#e6d5b8]/60 text-xs tracking-wider uppercase group-hover:text-[#d4af37] transition-colors"
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
    </section>
  );
};

export default AccountPanel;
