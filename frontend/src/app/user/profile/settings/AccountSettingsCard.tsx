import Link from "next/link";
import AuthPageShell from "@/components/AuthPageShell";
import AgreementRows from "../AgreementRows";
import ContactSupportRow from "../ContactSupportRow";
import ResetPasswordRequestButton from "../ResetPasswordRequestButton";
import type { UserConsents } from "@/lib/consent";

const CINZEL = { fontFamily: "'Cinzel', serif" } as const;
const CRIMSON = { fontFamily: "'Crimson Pro', serif" } as const;

interface AccountSettingsCardProps {
  /** The signed-in account's address — where support replies and reset links go */
  email: string;
  /** From `getCurrentUser()` on the page — no extra fetch */
  consents: UserConsents | undefined;
}

/** The account's housekeeping, moved off the Sanctum: support, agreements,
    password reset and, set apart at the bottom, deletion. */
const AccountSettingsCard = ({ email, consents }: AccountSettingsCardProps) => (
  <AuthPageShell
    glyph={<>&#9881;</>}
    title="Account Settings"
    backButtonHref="/user/profile"
    backButtonLabel="Sanctum"
  >
    <p className="text-[#e6d5b8]/60 text-sm text-center mb-2" style={CRIMSON}>
      Seek counsel, review your agreements, renew your password, or leave the Sanctum.
    </p>

    <div className="mb-4 text-center">
      <p
        className="text-[#e6d5b8]/40 text-xs tracking-[0.2em] uppercase mb-1"
        style={CINZEL}
      >
        Signed in as
      </p>
      <p className="text-[#e6d5b8] text-base break-all" style={CRIMSON}>
        {email}
      </p>
    </div>

    <ContactSupportRow />

    <div className="mt-4">
      <AgreementRows consents={consents} />
    </div>

    <div className="pt-4 border-t border-[#d4af37]/10">
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
        style={CINZEL}
      >
        Delete account
      </Link>
    </div>
  </AuthPageShell>
);

export default AccountSettingsCard;
