import React, { useMemo } from "react";
import { resolvePositions, isBirthdateSpread } from "@/lib/reading-positions";
import { isTreeOfLife } from "@/components/Reading";
import {
  isRelationship,
  groupByPillar,
  RELATIONSHIP_PILLARS,
  CARDS_PER_PILLAR,
  type PillarNameOverrides,
} from "@/lib/relationship-spread";
import type { ReadingConfig } from "@/types/reading";

const cinzel = { fontFamily: "'Cinzel', serif" } as const;

// Mirrors the row order hand-written in KabbalahLayout.tsx — keep in sync.
const TREE_ROWS: string[][] = [
  ["Kether"],
  ["Binah", "Chokmah"],
  ["Daath"],
  ["Geburah", "Chesed"],
  ["Tiphereth"],
  ["Hod", "Netzach"],
  ["Yesod"],
  ["Malkuth"],
];

/** Pillar headers already name the pillar, so mini labels drop the suffix */
const stripPillarSuffix = (name: string) =>
  name.replace(/\s*-\s*(querent|relationship|other)\s*$/i, "");

type SlotSize = "sm" | "md";

const SLOT_W: Record<SlotSize, string> = {
  sm: "w-7 sm:w-8",
  md: "w-9 sm:w-11",
};
const LABEL_CLS: Record<SlotSize, string> = {
  sm: "max-w-[3.5rem] text-[8px]",
  md: "max-w-[5rem] text-[8px]",
};

interface MiniSlotProps {
  name: string;
  size?: SlotSize;
  index?: number;
}

const MiniSlot: React.FC<MiniSlotProps> = ({ name, size = "md", index = 0 }) => (
  <div
    className="flex flex-col items-center gap-1"
    style={{ animation: `fadeIn 0.5s ease-out ${index * 0.05}s backwards` }}
  >
    <div
      className={`spread-preview-slot ${SLOT_W[size]} aspect-[3/5] rounded-md
                  border border-dashed border-[#d4af37]/50 bg-[#1a0033]/40
                  flex items-center justify-center`}
    >
      <span className="text-[#d4af37]/40 text-[10px]" aria-hidden="true">✦</span>
    </div>
    <span
      className={`${LABEL_CLS[size]} text-center leading-tight
                  text-[#d4af37]/60 uppercase tracking-wider break-words`}
      style={cinzel}
    >
      {name}
    </span>
  </div>
);

const TreeShape: React.FC<{ names: string[] }> = ({ names }) => {
  const byLowerName = new Map(names.map((n) => [n.trim().toLowerCase(), n]));
  let slot = 0;
  return (
    <div className="flex flex-col items-center gap-1.5">
      {TREE_ROWS.map((row) => (
        <div key={row.join("-")} className="flex justify-center gap-4 sm:gap-5">
          {row.map((sephira) => {
            const label = byLowerName.get(sephira.toLowerCase());
            return label ? <MiniSlot key={sephira} name={label} size="sm" index={slot++} /> : null;
          })}
        </div>
      ))}
    </div>
  );
};

const RelationshipShape: React.FC<{
  names: string[];
  pillarLabels?: PillarNameOverrides;
}> = ({ names, pillarLabels }) => {
  const pillars = groupByPillar(names);
  return (
    <div className="grid grid-cols-3 gap-x-2 sm:gap-x-3 gap-y-2 max-w-xs">
      {RELATIONSHIP_PILLARS.map((pillar, p) => (
        <div key={pillar.key} className="flex flex-col items-center gap-2">
          <span
            className="text-[9px] text-[#d4af37]/70 tracking-widest uppercase text-center"
            style={cinzel}
          >
            {(pillar.key !== "relationship" && pillarLabels?.[pillar.key]) || pillar.label}
          </span>
          {pillars[p].map((idx, row) =>
            idx !== undefined ? (
              <MiniSlot
                key={names[idx]}
                name={stripPillarSuffix(names[idx])}
                size="sm"
                index={p * CARDS_PER_PILLAR + row}
              />
            ) : (
              <div key={`empty-${row}`} />
            )
          )}
        </div>
      ))}
    </div>
  );
};

// A label short enough to stay on one line in a narrow column.
const SHORT_LABEL_CHARS = 6;
const NARROW_COL = "3.5rem";
const WIDE_COL = "4.75rem";
const GRID_GAP = "0.5rem"; // gap-2

/** Column count and width for the plain grid. Up to three cards sit on one row;
 *  four or more with short labels (Fire, Water, Air, Earth) stay on one row of
 *  narrow columns; otherwise long two-line labels get wide columns, two per row
 *  for four cards and three per row beyond that. */
const defaultColumns = (names: string[]) => {
  if (names.length <= 3) return { cols: Math.max(names.length, 1), width: WIDE_COL };
  if (names.every((n) => n.length <= SHORT_LABEL_CHARS)) {
    return { cols: Math.min(names.length, 4), width: NARROW_COL };
  }
  return { cols: names.length === 4 ? 2 : 3, width: WIDE_COL };
};

// Equal-width cells that wrap and centre, so a label that wraps to two lines
// never pushes its slot out of line, and a short last row stays centred.
const DefaultShape: React.FC<{ names: string[] }> = ({ names }) => {
  const { cols, width } = defaultColumns(names);
  return (
    <div
      data-cols={cols}
      className="flex flex-wrap justify-center gap-2"
      style={{ maxWidth: `calc(${cols} * ${width} + ${cols - 1} * ${GRID_GAP})` }}
    >
      {names.map((name, i) => (
        <div key={name} className="flex justify-center" style={{ width }}>
          <MiniSlot name={name} index={i} />
        </div>
      ))}
    </div>
  );
};

interface SpreadPreviewProps {
  reading: ReadingConfig;
  /** Custom querent/other names for the Relationship spread's column headers */
  pillarLabels?: PillarNameOverrides;
}

/**
 * Miniature preview of the selected spread: empty dashed-gold slots with
 * position names, arranged in the same shape the real reading will use.
 * Shape detection reuses the dispatch logic from Reading/relationship-spread.
 */
const SpreadPreview: React.FC<SpreadPreviewProps> = ({ reading, pillarLabels }) => {
  const names = useMemo(
    () => resolvePositions(reading).map((p) => p.name),
    [reading]
  );
  const tree = isTreeOfLife(names);
  const relationship = isRelationship(names);

  return (
    // Keyed by spread so the panel re-mounts (and re-animates) on selection change
    <div
      key={reading.name}
      className="animate-fadeIn relative rounded-xl border-2 border-[#d4af37]/30 backdrop-blur-sm shadow-2xl
                 w-full max-w-xs h-full px-4 py-5"
      style={{ background: "linear-gradient(135deg, rgba(26,0,51,0.95), rgba(45,27,78,0.95))" }}
    >
      {/* Mystical glow, matching the oracle card */}
      <div
        className="absolute inset-0 rounded-xl opacity-30 pointer-events-none"
        style={{ background: "radial-gradient(circle at 50% 50%, rgba(212,175,55,0.15), transparent 70%)" }}
      />
      {/* Corner stars */}
      <span className="absolute top-1.5 left-2 text-[#d4af37]/40 text-[10px]" aria-hidden="true">✦</span>
      <span className="absolute top-1.5 right-2 text-[#d4af37]/40 text-[10px]" aria-hidden="true">✦</span>
      <span className="absolute bottom-1.5 left-2 text-[#d4af37]/40 text-[10px]" aria-hidden="true">✦</span>
      <span className="absolute bottom-1.5 right-2 text-[#d4af37]/40 text-[10px]" aria-hidden="true">✦</span>

      <div className="relative flex flex-col items-center h-full gap-4">
        <div className="flex items-center justify-center gap-2 w-full">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#d4af37]/40" />
          <span
            className="text-[10px] text-[#d4af37]/60 tracking-[0.25em] uppercase whitespace-nowrap"
            style={cinzel}
          >
            Spread Layout
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#d4af37]/40" />
        </div>

        {/* Fills the card when it is stretched to the oracle card's height; centers small spreads */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          {tree ? (
            <TreeShape names={names} />
          ) : relationship ? (
            <RelationshipShape names={names} pillarLabels={pillarLabels} />
          ) : (
            <DefaultShape names={names} />
          )}

          {isBirthdateSpread(reading) && (
            <p
              className="text-[#e6d5b8]/40 text-[10px] italic text-center"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              Derived from your birth date
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpreadPreview;
