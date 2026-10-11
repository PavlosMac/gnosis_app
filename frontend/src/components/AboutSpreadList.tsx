import React from "react";
import type { AboutSpread } from "@/lib/about-content";

interface AboutSpreadListProps {
  spreads: AboutSpread[];
}

const countLabel = (cardCount: number | null): string => {
  if (cardCount === null) return "Birth date";
  return cardCount === 1 ? "1 card" : `${cardCount} cards`;
};

/** The Reading Oracle's spreads, straight from readings-config.json, with article blurbs. */
const AboutSpreadList: React.FC<AboutSpreadListProps> = ({ spreads }) => (
  <ul className="space-y-4 list-none p-0">
    {spreads.map((spread) => (
      <li
        key={spread.name}
        className="p-4 border border-[#d4af37]/30 rounded-lg bg-[#1a0033]/50"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3
            className="text-lg sm:text-xl text-[#d4af37] tracking-wider"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {spread.name}
          </h3>
          <span
            className="text-[10px] text-[#d4af37]/60 tracking-widest uppercase
                       border border-[#d4af37]/20 px-2 py-1 rounded-full whitespace-nowrap"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {countLabel(spread.cardCount)}
          </span>
        </div>
        <p
          className="text-[#e6d5b8]/60 italic text-base sm:text-lg leading-relaxed"
          style={{ fontFamily: "'Crimson Pro', serif" }}
        >
          {spread.description}
        </p>
        {spread.blurb && (
          <p
            className="mt-2 text-[#e6d5b8]/90 text-base sm:text-lg leading-relaxed"
            style={{ fontFamily: "'Crimson Pro', serif" }}
          >
            {spread.blurb}
          </p>
        )}
      </li>
    ))}
  </ul>
);

export default AboutSpreadList;
