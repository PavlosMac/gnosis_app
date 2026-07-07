"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import readingsConfig from "@/lib/readings-config.json";

const SIGNIFICATORS_SPREAD_TYPE = "Significators";

interface ReadingsFilterPanelProps {
  currentSpreadType?: string;
  currentTags?: string;
  currentBirthDate?: string;
}

const ReadingsFilterPanel = ({
  currentSpreadType,
  currentTags,
  currentBirthDate,
}: ReadingsFilterPanelProps) => {
  const router = useRouter();
  const hasActiveFilter = Boolean(currentSpreadType || currentTags || currentBirthDate);
  const [expanded, setExpanded] = useState(hasActiveFilter);
  const [spreadType, setSpreadType] = useState(currentSpreadType ?? "");
  const [tags, setTags] = useState(currentTags ?? "");
  const [birthDate, setBirthDate] = useState(
    currentSpreadType === SIGNIFICATORS_SPREAD_TYPE ? currentBirthDate ?? "" : ""
  );

  const isSignificators = spreadType === SIGNIFICATORS_SPREAD_TYPE;

  const togglePill = (name: string) => {
    setSpreadType((prev) => {
      const next = prev === name ? "" : name;
      if (next !== SIGNIFICATORS_SPREAD_TYPE) setBirthDate("");
      return next;
    });
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (spreadType) params.set("spread_type", spreadType);
    if (tags.trim()) params.set("tags", tags.trim());
    if (birthDate) params.set("birth_date", birthDate);
    router.push(`/user/readings?${params.toString()}`);
  };

  const clearFilters = () => {
    setSpreadType("");
    setTags("");
    setBirthDate("");
    setExpanded(false);
    router.push("/user/readings");
  };

  return (
    <div className="mb-8">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="text-[#d4af37]/50 hover:text-[#d4af37]/80 transition-colors text-sm tracking-widest select-none block mx-auto"
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        &#9671; Filter Readings &#9671;
      </button>

      {expanded && (
        <div className="mt-6 rounded-xl border border-[#d4af37]/20 bg-gradient-to-b from-[#1a0033]/60 to-[#0a0015]/60 backdrop-blur-sm p-5 sm:p-6 flex flex-col gap-5">
          <div>
            <p
              className="text-xs text-[#d4af37]/60 tracking-widest uppercase mb-2"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Spread Type
            </p>
            <div className="flex flex-wrap gap-2">
              {readingsConfig.readings.map((reading) => (
                <button
                  key={reading.name}
                  type="button"
                  aria-pressed={spreadType === reading.name}
                  onClick={() => togglePill(reading.name)}
                  className={`px-4 py-2 rounded-full border text-xs sm:text-sm tracking-wide transition-all duration-300
                    ${spreadType === reading.name
                      ? 'bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] border-[#d4af37] font-bold'
                      : 'border-[#d4af37]/30 text-[#e6d5b8]/60 hover:border-[#d4af37]/60 hover:text-[#e6d5b8]/90'}`}
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {reading.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="tags-filter"
              className="block text-xs text-[#d4af37]/60 tracking-widest uppercase mb-2"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Tags
            </label>
            <input
              id="tags-filter"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="career, love"
              className="w-full px-4 py-3 rounded-lg bg-[#0a0015]/60 border border-[#d4af37]/20
                         text-[#e6d5b8] placeholder-[#e6d5b8]/20 text-sm
                         focus:outline-none focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/20
                         transition-all duration-300"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            />
          </div>

          <div
            className={`grid transition-[grid-template-rows,margin-top] duration-300 ease-in-out
              ${isSignificators ? "grid-rows-[1fr] mt-0" : "grid-rows-[0fr] -mt-5"}`}
          >
            <div className="overflow-hidden min-h-0">
              <label
                htmlFor="birth-date-filter"
                className="block text-xs text-[#d4af37]/60 tracking-widest uppercase mb-2"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Birth Date
              </label>
              <input
                id="birth-date-filter"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                disabled={!isSignificators}
                style={{ colorScheme: "dark", fontFamily: "'Crimson Pro', serif" }}
                className="w-full px-4 py-3 rounded-lg bg-[#0a0015]/60 border border-[#d4af37]/20
                           text-[#e6d5b8] text-sm
                           focus:outline-none focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/20
                           transition-all duration-300"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={applyFilters}
              className="px-8 py-3 bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] rounded-lg
                         font-bold hover:scale-105 active:scale-95 transition-all duration-300
                         border border-[#d4af37]/50 shadow-lg text-sm"
              style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.1em" }}
            >
              &#10022; Apply
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="px-8 py-3 border border-[#d4af37]/40 text-[#d4af37] hover:bg-[#d4af37]/10 rounded-lg transition-all text-sm"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              &#10006; Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadingsFilterPanel;
