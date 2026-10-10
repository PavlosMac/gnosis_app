import Link from "next/link";
import type { UserConsents } from "@/lib/consent";
import { agreementRowModel } from "@/lib/profile-dashboard";

interface AgreementRowsProps {
  /** From `getCurrentUser()` on the profile page — no extra fetch */
  consents: UserConsents | undefined;
}

const CINZEL = { fontFamily: "'Cinzel', serif" } as const;
const CRIMSON = { fontFamily: "'Crimson Pro', serif" } as const;

/** What the user agreed to: one row per legal document, linking to the exact
    version accepted, plus the way to review them at any time. */
const AgreementRows = ({ consents }: AgreementRowsProps) => (
  <div className="pt-4 pb-4 border-t border-[#d4af37]/10">
    <div className="flex items-center justify-between gap-4" style={{ marginBottom: "0.75rem" }}>
      <span className="text-[#e6d5b8]/60 text-sm tracking-wider uppercase" style={CINZEL}>
        Agreements
      </span>
      <Link
        href="/user/profile/manage-consent"
        className="text-[#d4af37]/60 hover:text-[#d4af37] text-xs tracking-wider uppercase transition-colors"
        style={CINZEL}
      >
        Review / change
      </Link>
    </div>

    <ul className="space-y-2">
      {agreementRowModel(consents).map(({ id, title, accepted, href, detail }) => (
        <li key={id} className="flex items-center justify-between gap-4">
          <span className="flex items-center min-w-0" style={{ gap: "0.5rem" }}>
            <span
              className={accepted ? "text-[#d4af37]" : "text-[#e6d5b8]/30"}
              aria-hidden="true"
            >
              {accepted ? "✓" : "☐"}
            </span>
            <Link
              href={href}
              className="text-[#e6d5b8] hover:text-[#d4af37] text-sm truncate transition-colors underline-offset-4 hover:underline"
              style={CRIMSON}
            >
              {title}
            </Link>
          </span>
          <span className="text-[#e6d5b8]/50 text-xs shrink-0" style={CRIMSON}>
            {detail}
          </span>
        </li>
      ))}
    </ul>
  </div>
);

export default AgreementRows;
