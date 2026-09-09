import React from "react";
import TarotCard from "./TarotCard";
import type { SelectedCard } from "@/types/reading";
import {
  RELATIONSHIP_PILLARS,
  CARDS_PER_PILLAR,
  groupByPillar,
  extractPillarNames,
  positionCaption,
} from "@/lib/relationship-spread";

interface RelationshipLayoutProps {
  selectedCards: SelectedCard[];
  positions: string[];
}

/**
 * 3×3 relationship spread: querent (left), relationship (middle), other (right).
 * Cards are placed by the pillar and row their position name belongs to (see
 * groupByPillar), so a missing card or a reordered list never shifts cards
 * between pillars or between rows — a missing card leaves an empty cell in its
 * own row rather than pulling the ones below it up. One flat grid holds all
 * nine cells in row order, so rows stay aligned even when a label wraps or a
 * "(Reversed)" caption appears in only one pillar. The grid stays 3-wide on
 * every breakpoint — small cards are 80px below `sm:`, so three fit across a
 * 320px phone. Meanings are omitted (as in KabbalahLayout): nine of them
 * would bury the spread.
 */
const RelationshipLayout: React.FC<RelationshipLayoutProps> = ({
  selectedCards,
  positions,
}) => {
  const pillars = groupByPillar(positions);
  // Custom querent/other names travel inside the position strings (live game
  // and saved readings alike), so headers are derived rather than passed in
  const pillarLabels = extractPillarNames(positions);

  return (
    <div className="grid grid-cols-3 items-start gap-x-1 gap-y-4 sm:gap-x-6 sm:gap-y-6 px-1 sm:px-4 max-w-4xl mx-auto">
      {RELATIONSHIP_PILLARS.map(({ key, label }) => (
        <h3
          key={key}
          className="text-[10px] sm:text-sm text-[#d4af37] tracking-[0.2em] sm:tracking-[0.3em] uppercase border-b border-[#d4af37]/30 pb-1 sm:pb-2 w-full text-center"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          {(key !== "relationship" && pillarLabels?.[key]) || label}
        </h3>
      ))}
      {Array.from({ length: CARDS_PER_PILLAR }, (_, row) =>
        pillars.map((indices, col) => {
          const i = indices[row];
          if (i === undefined) return <div key={`${row}-${col}`} />;
          const card = selectedCards[i];
          if (!card) return <div key={`${row}-${col}`} />;
          return (
            <div
              key={`${row}-${col}`}
              className="reading-card-reveal flex flex-col items-center w-full min-w-0"
              style={{ animationDelay: `${row * 0.2}s` }}
            >
              <div className="text-center mb-1 sm:mb-2 px-1 w-full">
                <span
                  className="block text-[9px] sm:text-xs leading-tight text-[#d4af37]/70 tracking-wide sm:tracking-widest break-words"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {positionCaption(positions[i], pillarLabels).toUpperCase()}
                </span>
              </div>
              <TarotCard card={card} small={true} showMeaning={false} />
            </div>
          );
        })
      )}
    </div>
  );
};

export default RelationshipLayout;
