"use client";

import { useState } from "react";

interface SpreadTypeDropdownProps {
  names: string[];
  selected: string;
  onToggle: (name: string) => void;
}

const SpreadTypeDropdown = ({ names, selected, onToggle }: SpreadTypeDropdownProps) => {
  const [open, setOpen] = useState(false);

  const pick = (name: string) => {
    onToggle(name);
    setOpen(false);
  };

  return (
    // Inline zIndex (not Tailwind z-* classes): the layering must hold even when
    // the dev server's generated CSS predates this file — a missing z utility
    // silently computes to z-auto and the popup slid under the Tags section.
    <div
      className="relative"
      style={{ zIndex: 40 }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
      // Close when keyboard focus leaves the component (e.g. Tab into the Tags
      // field below). Focus moving between the trigger and the option buttons
      // stays inside the wrapper, so it doesn't count as leaving.
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="w-full px-4 py-3 rounded-lg bg-[#0a0015]/60 border border-[#d4af37]/20
                   focus:outline-none focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/20
                   transition-all duration-300 flex items-center justify-between gap-2"
      >
        {selected ? (
          <span
            className="px-3 py-1 rounded-full bg-gradient-to-br from-[#d4af37] to-[#b8942f]
                       text-[#1a0033] border border-[#d4af37] font-bold text-xs tracking-wide"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {selected}
          </span>
        ) : (
          <span
            className="text-[#e6d5b8]/40 text-sm"
            style={{ fontFamily: "'Crimson Pro', serif" }}
          >
            Any Spread
          </span>
        )}
        <span
          className={`text-[#d4af37]/60 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open && (
        <>
          {/* Click-away layer, below the dropdown panel */}
          <div
            aria-hidden="true"
            className="fixed inset-0"
            style={{ zIndex: 30 }}
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-[#d4af37]/30
                       p-3 shadow-[0_0_20px_rgba(212,175,55,0.25)]"
            // Background inline for the same reason as the tag suggestions
            // panel: dev-CSS regeneration can miss new utility classes.
            style={{
              zIndex: 40,
              background: "linear-gradient(to bottom, #1a0033, #0a0015)",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <div className="flex flex-wrap gap-2">
              {names.map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={selected === name}
                  onClick={() => pick(name)}
                  className={`px-4 py-2 rounded-full border text-xs sm:text-sm tracking-wide transition-all duration-300
                    ${selected === name
                      ? 'bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] border-[#d4af37] font-bold'
                      : 'border-[#d4af37]/30 text-[#e6d5b8]/60 hover:border-[#d4af37]/60 hover:text-[#e6d5b8]/90'}`}
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SpreadTypeDropdown;
