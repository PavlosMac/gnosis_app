import Link from "next/link";
import TarotPageLayout from "@/components/TarotPageLayout";

/*
 * The shared chrome of every auth page (login, register, forgot/reset
 * password): glyph + title header, the translucent card, and the pieces that
 * sit inside it. One place to restyle; the pages keep only their own form.
 */

interface AuthPageShellProps {
  /** Decorative symbol above the title (a moon, sun, etc.) */
  glyph: React.ReactNode;
  title: string;
  backButtonHref: string;
  backButtonLabel: string;
  /** Rendered inside the card */
  children: React.ReactNode;
}

const AuthPageShell = ({
  glyph,
  title,
  backButtonHref,
  backButtonLabel,
  children,
}: AuthPageShellProps) => (
  <TarotPageLayout backButtonHref={backButtonHref} backButtonLabel={backButtonLabel}>
    <div className="w-full max-w-md mx-auto mt-8 sm:mt-16 px-4 sm:px-0">
      {/* Header */}
      <div className="text-center mb-10">
        <span className="text-4xl text-[#d4af37]/80">{glyph}</span>
        <h1
          className="text-3xl text-[#d4af37] tracking-[0.2em] mt-4"
          style={{
            fontFamily: "'Cinzel', serif",
            textShadow: "0 0 30px rgba(212,175,55,0.4)",
          }}
        >
          {title}
        </h1>
        <div className="flex items-center justify-center gap-3 mt-3">
          <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#d4af37]/40" />
          <span className="text-[#d4af37]/60 text-sm">&#9765;</span>
          <div className="w-12 h-px bg-gradient-to-l from-transparent to-[#d4af37]/40" />
        </div>
      </div>

      {/* Card container */}
      <div className="relative rounded-2xl border border-[#d4af37]/20 bg-gradient-to-b from-[#1a0033]/80 to-[#0a0015]/80 backdrop-blur-sm p-5 sm:p-8">
        {children}
      </div>
    </div>
  </TarotPageLayout>
);

interface AuthErrorBannerProps {
  /** Nothing renders when empty — callers pass `state.error` straight through */
  message?: string;
  /** Spacing is the caller's call: `mb-6` above a form, none for a lone panel */
  className?: string;
}

export const AuthErrorBanner = ({ message, className = "" }: AuthErrorBannerProps) =>
  message ? (
    <p
      className={`text-center text-sm text-red-400/90 border border-red-400/20 rounded-lg px-4 py-3 bg-red-400/5 ${className}`}
      style={{ fontFamily: "'Crimson Pro', serif" }}
    >
      {message}
    </p>
  ) : null;

interface AuthSubmitButtonProps {
  pending: boolean;
  /** Label while the action is in flight, e.g. "Entering..." */
  pendingLabel: string;
  children: React.ReactNode;
}

export const AuthSubmitButton = ({ pending, pendingLabel, children }: AuthSubmitButtonProps) => (
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
    {pending ? pendingLabel : children}
  </button>
);

interface AuthFootnoteProps {
  /** Defaults to `mt-6`; the login page stacks a second note at `mt-3` */
  className?: string;
  children: React.ReactNode;
}

/** The muted line under a form: "No account yet? Begin your journey" */
export const AuthFootnote = ({ className = "mt-6", children }: AuthFootnoteProps) => (
  <p
    className={`${className} text-center text-[#e6d5b8]/50 text-sm`}
    style={{ fontFamily: "'Crimson Pro', serif" }}
  >
    {children}
  </p>
);

interface AuthLinkProps {
  href: string;
  children: React.ReactNode;
}

/** Gold inline link used inside an AuthFootnote */
export const AuthLink = ({ href, children }: AuthLinkProps) => (
  <Link
    href={href}
    className="text-[#d4af37]/70 hover:text-[#d4af37] transition-colors underline-offset-4 hover:underline"
  >
    {children}
  </Link>
);

export default AuthPageShell;
