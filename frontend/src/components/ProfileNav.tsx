'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { logout } from '@/app/user/logout/actions';
import { useAuth } from '@/app/providers/auth-provider';
import type { User } from '@/types/auth';

const MENU_LINK_CLASS =
  'block px-4 py-2 text-sm text-[#d4af37]/80 hover:text-[#d4af37] hover:bg-[#d4af37]/5 transition-colors';

interface ProfileNavMenuProps {
  user: User | null;
  /** Hides "Sign up" when the REGISTRATION_ENABLED flag is off */
  registrationEnabled: boolean;
  /** Closes the dropdown after a link is followed */
  onNavigate: () => void;
}

/** The dropdown's contents, split out so they can be rendered (and tested)
    without the open/closed state of the button */
export const ProfileNavMenu = ({ user, registrationEnabled, onNavigate }: ProfileNavMenuProps) => (
  <div className="absolute top-12 right-0 min-w-[180px] bg-[#0a0015]/95 backdrop-blur-sm border border-[#d4af37]/20 rounded-lg shadow-xl py-2 font-[Cinzel,serif]">
    {user ? (
      <>
        <div className="px-4 py-2 text-[#d4af37]/50 text-xs truncate border-b border-[#d4af37]/10 mb-1">
          {user.displayName ?? user.email}
        </div>
        <Link href="/user/profile" onClick={onNavigate} className={MENU_LINK_CLASS}>
          Profile
        </Link>
        <Link href="/user/readings" onClick={onNavigate} className={MENU_LINK_CLASS}>
          Readings
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="w-full text-left px-4 py-2 text-sm text-[#d4af37]/60 hover:text-[#d4af37]/90 hover:bg-[#d4af37]/5 transition-colors"
          >
            Logout
          </button>
        </form>
      </>
    ) : (
      <>
        <Link href="/user/login" onClick={onNavigate} className={MENU_LINK_CLASS}>
          Login
        </Link>
        {registrationEnabled && (
          <Link href="/user/register" onClick={onNavigate} className={MENU_LINK_CLASS}>
            Sign up
          </Link>
        )}
      </>
    )}
  </div>
);

export default function ProfileNav() {
  const { user, registrationEnabled } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // absolute below lg: the page's card grids (max-w-[856px], see FaceUpDeck/ShuffledDeck)
  // don't gain side margins wide enough to clear this button until ~968px viewport width,
  // so a pinned button would sit over cards there; scrolling with the page (like the
  // Portal link) keeps it clear until the grid margin is safely wider than the button.
  return (
    <div ref={ref} className="absolute lg:fixed top-4 right-4 z-[9999]">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Profile menu"
        className="w-10 h-10 rounded-full flex items-center justify-center text-[#d4af37] text-xl bg-[#0a0015]/80 border border-[#d4af37]/30 hover:border-[#d4af37]/60 hover:bg-[#0a0015]/90 transition-all duration-200 shadow-lg"
      >
        ☥
      </button>
      {open && (
        <ProfileNavMenu
          user={user}
          registrationEnabled={registrationEnabled}
          onNavigate={() => setOpen(false)}
        />
      )}
    </div>
  );
}
