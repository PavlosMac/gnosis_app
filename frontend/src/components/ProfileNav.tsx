'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { logout } from '@/app/user/logout/actions';
import { useAuth } from '@/app/providers/auth-provider';

export default function ProfileNav() {
  const { user } = useAuth();
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

  return (
    <div ref={ref} className="fixed top-4 right-4 z-[9999]">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Profile menu"
        className="w-10 h-10 rounded-full flex items-center justify-center text-[#d4af37] text-xl bg-[#0a0015]/80 border border-[#d4af37]/30 hover:border-[#d4af37]/60 hover:bg-[#0a0015]/90 transition-all duration-200 shadow-lg"
      >
        ☥
      </button>
      {open && (
        <div className="absolute top-12 right-0 min-w-[180px] bg-[#0a0015]/95 backdrop-blur-sm border border-[#d4af37]/20 rounded-lg shadow-xl py-2 font-[Cinzel,serif]">
          {user ? (
            <>
              <div className="px-4 py-2 text-[#d4af37]/50 text-xs truncate border-b border-[#d4af37]/10 mb-1">
                {user.displayName ?? user.email}
              </div>
              <Link
                href="/user/profile"
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-[#d4af37]/80 hover:text-[#d4af37] hover:bg-[#d4af37]/5 transition-colors"
              >
                Profile
              </Link>
              <Link
                href="/user/readings"
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-[#d4af37]/80 hover:text-[#d4af37] hover:bg-[#d4af37]/5 transition-colors"
              >
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
            <Link
              href="/user/login"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-[#d4af37]/80 hover:text-[#d4af37] hover:bg-[#d4af37]/5 transition-colors"
            >
              Login
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
