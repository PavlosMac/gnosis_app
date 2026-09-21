"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlayingCards } from "lucide-react";
import { SIGNIFICATORS_SPREAD } from "@/lib/significator-positions";
import readingsConfig from "@/lib/readings-config.json";
import TagFilterCombobox from "@/components/TagFilterCombobox";
import SpreadTypeDropdown from "@/components/SpreadTypeDropdown";
import { parseTagsParam, serializeTags } from "@/lib/tag-suggestions";
import type { TagSummary } from "@/types/reading";


interface ReadingsFilterPanelProps {
  currentSpreadType?: string;
  currentTags?: string;
  currentBirthDate?: string;
  availableTags?: TagSummary[];
}

const ReadingsFilterPanel = ({
  currentSpreadType,
  currentTags,
  currentBirthDate,
  availableTags = [],
}: ReadingsFilterPanelProps) => {
  const router = useRouter();
  const hasActiveFilter = Boolean(currentSpreadType || currentTags || currentBirthDate);
  const [expanded, setExpanded] = useState(hasActiveFilter);
  const [spreadType, setSpreadType] = useState(currentSpreadType ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>(() =>
    parseTagsParam(currentTags)
  );
  const [tagInput, setTagInput] = useState("");
  const [birthDate, setBirthDate] = useState(
    currentSpreadType === SIGNIFICATORS_SPREAD ? currentBirthDate ?? "" : ""
  );

  const isSignificators = spreadType === SIGNIFICATORS_SPREAD;

  // Saved readings can carry a spread_type that no longer matches any current
  // config entry (e.g. a reading was renamed after being saved). Keep that
  // legacy name selectable as a pill so old readings stay filterable instead
  // of silently disappearing from the panel.
  const spreadTypeNames = readingsConfig.readings.map((reading) => reading.name);
  const pillNames =
    currentSpreadType && !spreadTypeNames.includes(currentSpreadType)
      ? [...spreadTypeNames, currentSpreadType]
      : spreadTypeNames;

  const togglePill = (name: string) => {
    setSpreadType((prev) => {
      const next = prev === name ? "" : name;
      if (next !== SIGNIFICATORS_SPREAD) setBirthDate("");
      return next;
    });
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (spreadType) params.set("spread_type", spreadType);
    // Uncommitted input text counts too, matching the tag editor's save behavior
    const pending = tagInput.trim().toLowerCase();
    const allTags =
      pending && !selectedTags.includes(pending)
        ? [...selectedTags, pending]
        : selectedTags;
    if (allTags.length) params.set("tags", serializeTags(allTags));
    if (birthDate) params.set("birth_date", birthDate);
    router.push(`/user/readings?${params.toString()}`);
  };

  const clearFilters = () => {
    setSpreadType("");
    setSelectedTags([]);
    setTagInput("");
    setBirthDate("");
    setExpanded(false);
    router.push("/user/readings");
  };

  return (
    // relative z-30 lifts the whole panel above the readings list; the blurred
    // container below forms its own stacking context, so the dropdown's z-index
    // alone can't win against later siblings.
    <div className="relative z-30 mb-8">
      {/* The toggle stays centred; the new-reading button sits on the same line, top right */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-[#d4af37]/50 hover:text-[#d4af37]/80 transition-colors text-sm tracking-widest select-none block mx-auto"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          &#9671; Filter Readings &#9671;
        </button>

        {/* Same icon and tooltip as the profile page's "New reading" action. The wrapper
            carries the positioning: .sanctum-tip sets position: relative in unlayered CSS,
            which would beat Tailwind's layered `absolute` on the link itself. Inline
            borderRadius hedges the open Chrome rounded-full finding (issues.md 2026-09-11) */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2">
          <Link
            href="/reading"
            aria-label="New reading"
            className="sanctum-tip inline-flex items-center justify-center
                       bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] border border-[#d4af37]/50 shadow-lg
                       hover:scale-105 active:scale-95 transition-all duration-300"
            // A true circle: fixed equal sides set inline, so the shape never depends on
            // which Tailwind utilities the running dev server happens to serve
            style={{
              width: "2.25rem",
              height: "2.25rem",
              minWidth: "2.25rem",
              padding: 0,
              flexShrink: 0,
              boxSizing: "border-box",
              borderRadius: "50%",
            }}
          >
            <PlayingCards size={18} strokeWidth={1.75} aria-hidden="true" />
            <span className="sanctum-tip__label sanctum-tip__label--end" aria-hidden="true">
              New reading
            </span>
          </Link>
        </div>
      </div>

      {expanded && (
        <div className="mt-6 rounded-xl border border-[#d4af37]/20 bg-gradient-to-b from-[#1a0033]/60 to-[#0a0015]/60 backdrop-blur-sm p-5 sm:p-6 flex flex-col gap-5">
          <div>
            <p
              className="text-xs text-[#d4af37]/60 tracking-widest uppercase mb-2"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Spread Type
            </p>
            <SpreadTypeDropdown
              names={pillNames}
              selected={spreadType}
              onToggle={togglePill}
            />
          </div>

          <div>
            <label
              htmlFor="tags-filter"
              className="block text-xs text-[#d4af37]/60 tracking-widest uppercase mb-2"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Tags
            </label>
            <TagFilterCombobox
              availableTags={availableTags}
              selectedTags={selectedTags}
              input={tagInput}
              onSelectedTagsChange={setSelectedTags}
              onInputChange={setTagInput}
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
