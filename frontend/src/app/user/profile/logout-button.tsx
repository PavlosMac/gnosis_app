import { logout } from "@/app/user/logout/actions";

const LogoutButton = () => (
  <form action={logout}>
    <button
      type="submit"
      className="w-full py-2 rounded-lg border border-[#d4af37]/20 text-[#d4af37]/50
                 hover:border-[#d4af37]/40 hover:text-[#d4af37]/80
                 text-sm tracking-widest uppercase transition-all duration-300"
      style={{ fontFamily: "'Cinzel', serif" }}
    >
      Depart the Sanctum
    </button>
  </form>
);

export default LogoutButton;
