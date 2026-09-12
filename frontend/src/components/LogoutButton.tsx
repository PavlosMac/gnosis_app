import { logout } from "@/app/user/logout/actions";

interface LogoutButtonProps {
  /** Button content; defaults to the classic "Depart the Sanctum" label */
  children?: React.ReactNode;
  /** Accessible name; defaults to the classic "Depart the Sanctum" label.
      Pass this explicitly whenever `children` shortens the visible text
      (e.g. an icon + "Depart"), so screen readers still hear the full name. */
  "aria-label"?: string;
}

const LogoutButton = ({
  children = "Depart the Sanctum",
  "aria-label": ariaLabel = "Depart the Sanctum",
}: LogoutButtonProps) => (
  <form action={logout}>
    <button
      type="submit"
      aria-label={ariaLabel}
      className="w-full py-2 rounded-lg border border-[#d4af37]/20 text-[#d4af37]/50
                 hover:border-[#d4af37]/40 hover:text-[#d4af37]/80
                 text-sm tracking-widest uppercase transition-all duration-300
                 inline-flex items-center justify-center gap-2"
      style={{ fontFamily: "'Cinzel', serif" }}
    >
      {children}
    </button>
  </form>
);

export default LogoutButton;
