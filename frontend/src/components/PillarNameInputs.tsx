"use client";
import React, { useEffect, useRef, useState } from "react";

const cinzel = { fontFamily: "'Cinzel', serif" } as const;

export type PillarNameKey = "querent" | "other";

const FIELDS: { key: PillarNameKey; defaultName: string; caption: string; side: string }[] = [
  { key: "querent", defaultName: "Querent", caption: "Left Pillar", side: "left" },
  { key: "other", defaultName: "Other", caption: "Right Pillar", side: "right" },
];

const NAME_MAX_LENGTH = 30;

// Pillar identity is recovered from the name suffixes of a saved reading, so
// names that collide with the keywords or with each other are ignored by the
// game (see pillarOverrides in TarotGame) — warn rather than let that surprise
const RESERVED_NAMES = new Set(["querent", "other", "relationship"]);

const namesWarning = (names: Record<PillarNameKey, string>): string | null => {
  const custom = FIELDS.flatMap(({ key, defaultName }) => {
    const value = names[key].trim();
    return value && value.toLowerCase() !== defaultName.toLowerCase()
      ? [{ value, lower: value.toLowerCase() }]
      : [];
  });
  if (custom.some(({ lower }) => RESERVED_NAMES.has(lower)))
    return "Querent, Other and Relationship are reserved — choose a true name";
  if (custom.length === 2 && custom[0].lower === custom[1].lower)
    return "The two souls need different names";
  return null;
};

const PadlockIcon: React.FC<{ locked: boolean }> = ({ locked }) => (
  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    {/* body */}
    <rect x="3" y="7" width="10" height="7" rx="1.5" />
    {/* shackle: closed drops into the body, open swings clear of it */}
    {locked ? <path d="M5 7V5a3 3 0 0 1 6 0v2" /> : <path d="M5 7V4.5a3 3 0 0 1 6-.5" transform="rotate(-28 5 7)" />}
  </svg>
);

interface PillarNameInputsProps {
  names: Record<PillarNameKey, string>;
  onChange: (key: PillarNameKey, value: string) => void;
}

/**
 * Relationship-spread pillar naming: two locked inputs holding the querent and
 * other names. Unlocking a field (padlock button) lets the user name a real
 * person so a reading can be made about others; re-locking an emptied field
 * restores the default name.
 */
const PillarNameInputs: React.FC<PillarNameInputsProps> = ({ names, onChange }) => {
  const [unlocked, setUnlocked] = useState<Record<PillarNameKey, boolean>>({ querent: false, other: false });
  const inputRefs = useRef<Partial<Record<PillarNameKey, HTMLInputElement | null>>>({});

  // Focus follows the padlock: unlocking a field is an invitation to type
  const justUnlocked = useRef<PillarNameKey | null>(null);
  useEffect(() => {
    if (justUnlocked.current) {
      inputRefs.current[justUnlocked.current]?.focus();
      justUnlocked.current = null;
    }
  }, [unlocked]);

  const toggleLock = (key: PillarNameKey, defaultName: string) => {
    const opening = !unlocked[key];
    if (opening) {
      justUnlocked.current = key;
    } else if (!names[key].trim()) {
      onChange(key, defaultName);
    }
    setUnlocked((prev) => ({ ...prev, [key]: opening }));
  };

  return (
    <div className="w-full max-w-md flex flex-col items-center animate-fadeIn">
      <div className="flex items-center justify-center gap-3 w-full mb-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#d4af37]/40" />
        <span className="text-[10px] sm:text-[11px] text-[#d4af37]/60 tracking-[0.2em] uppercase whitespace-nowrap" style={cinzel}>
          ✦ Who Is This Reading About? ✦
        </span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#d4af37]/40" />
      </div>

      <div className="flex w-full gap-2 sm:gap-4">
        {FIELDS.map(({ key, defaultName, caption, side }) => {
          const isUnlocked = unlocked[key];
          return (
            <div key={key} className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
              <div className="relative w-full">
                <input
                  ref={(el) => { inputRefs.current[key] = el; }}
                  type="text"
                  value={names[key]}
                  readOnly={!isUnlocked}
                  maxLength={NAME_MAX_LENGTH}
                  aria-label={`${caption} name`}
                  onChange={(e) => onChange(key, e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && isUnlocked) toggleLock(key, defaultName); }}
                  className={`w-full border-2 rounded-lg pl-4 pr-10 py-3 bg-[#1a0033]/80 backdrop-blur-sm text-base sm:text-lg
                              transition-all focus:outline-none
                              ${isUnlocked
                                ? "border-[#d4af37]/50 text-[#e6d5b8] focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30 shadow-[0_0_12px_rgba(212,175,55,0.25)]"
                                : "border-[#d4af37]/25 text-[#e6d5b8]/60 cursor-default"}`}
                  style={{ fontFamily: "'Crimson Pro', serif" }}
                />
                <button
                  type="button"
                  onClick={() => toggleLock(key, defaultName)}
                  aria-pressed={isUnlocked}
                  aria-label={`${isUnlocked ? "Lock" : "Unlock"} ${side} pillar name`}
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors
                              ${isUnlocked ? "text-[#d4af37]" : "text-[#d4af37]/50 hover:text-[#d4af37]/90"}`}
                >
                  <PadlockIcon locked={!isUnlocked} />
                </button>
              </div>
              <span className="text-[10px] text-[#d4af37]/50 tracking-[0.2em] uppercase" style={cinzel}>
                {caption}
              </span>
            </div>
          );
        })}
      </div>

      {namesWarning(names) ? (
        <p className="text-red-400/80 text-xs text-center mt-1" role="alert" style={{ fontFamily: "'Crimson Pro', serif" }}>
          {namesWarning(names)}
        </p>
      ) : (
        <p className="text-[#e6d5b8]/40 text-xs text-center mt-1" style={{ fontFamily: "'Crimson Pro', serif" }}>
          Unlock a pillar to add names to reading
        </p>
      )}
    </div>
  );
};

export default PillarNameInputs;
