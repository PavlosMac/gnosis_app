
import React from "react";
import TarotCard from "./TarotCard";
import KabbalahLayout from "./KabbalahLayout";
import { TarotCardData } from "../models";

interface SelectedCard extends TarotCardData {
  idx: number;
  reversed: boolean;
}

interface ReadingProps {
  selectedCards: SelectedCard[];
  positions: string[];
  question?: string;
  isComplete?: boolean;
}

// Detect if this is a Tree of Life reading based on positions
const isTreeOfLife = (positions: string[]): boolean => {
  const treePositions = [
    "kether",
    "chokmah",
    "binah",
    "chesed",
    "geburah",
    "tiphereth",
    "netzach",
    "hod",
    "yesod",
    "malkuth",
    "daath",
  ];
  const normalizedPositions = positions.map((p) => p.trim().toLowerCase());
  return treePositions.every((pos) => normalizedPositions.includes(pos));
};

const Reading: React.FC<ReadingProps> = ({
  selectedCards,
  positions,
  question,
  isComplete = false,
}) => {
  const useKabbalahLayout = isTreeOfLife(positions);

  return (
    <div className="w-full">
      {/* Question display */}
      {question && (
        <div className="text-center mb-6">
          <span
            className="text-xs text-[#d4af37]/70 tracking-widest uppercase"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Your Question
          </span>
          <p
            className="text-xl sm:text-2xl text-[#e6d5b8] mt-2 italic max-w-2xl mx-auto px-4"
            style={{ fontFamily: "'Crimson Pro', serif" }}
          >
            &ldquo;{question}&rdquo;
          </p>
          <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-[#d4af37]/50 to-transparent mx-auto mt-4" />
        </div>
      )}

      {useKabbalahLayout ? (
        <KabbalahLayout selectedCards={selectedCards} positions={positions} />
      ) : (
        <>
          {/* Cards display - Default layout */}
          <div className="flex flex-col md:flex-row gap-6 justify-center items-center md:items-start px-4 md:overflow-x-auto">
            {selectedCards.map((card, i) => (
              <div
                key={i}
                className="reading-card-reveal flex flex-col items-center flex-shrink-0"
                style={{ animationDelay: `${i * 0.3}s` }}
              >
                {/* Position label */}
                <div className="text-center mb-2">
                  <span
                    className="text-xs text-[#d4af37]/70 tracking-widest"
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    {positions[i]?.toUpperCase()}
                  </span>
                </div>

                <TarotCard card={card} small={false} showMeaning={isComplete} />
              </div>
            ))}
          </div>

          {/* Mystical divider */}
          <div className="flex items-center justify-center gap-4 my-8">
            <div className="w-12 h-0.5 bg-gradient-to-r from-transparent to-[#d4af37]/50" />
            <span className="text-[#d4af37] text-xl">✦</span>
            <div className="w-12 h-0.5 bg-gradient-to-l from-transparent to-[#d4af37]/50" />
          </div>

          {/* Interpretation hint */}
          <div className="text-center mt-6 px-4">
            <p
              className="text-[#e6d5b8]/70 text-sm italic max-w-2xl mx-auto"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              Now you have a rich, pictographic answer to your question. Meditate
              on the cards and let them guide you forward.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default Reading;
