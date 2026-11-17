
import React from "react";
import TarotCard from "./TarotCard";
import KabbalahLayout from "./KabbalahLayout";
import SignificatorsLayout from "./SignificatorsLayout";
import RelationshipLayout from "./RelationshipLayout";
import { isRelationship } from "@/lib/relationship-spread";
import { isSignificators } from "@/lib/significator-positions";

export { isRelationship };
import type { SelectedCard, SpreadCardSelectHandler } from "@/types/reading";
import type { SignificatorResult } from "@/lib/significators";

interface ReadingProps {
  selectedCards: SelectedCard[];
  positions: string[];
  question?: string;
  isComplete?: boolean;
  significatorResult?: SignificatorResult;
  /** Makes each drawn card a button. Significators cards are computed, not drawn, and stay plain */
  onCardSelect?: SpreadCardSelectHandler;
}

const TREE_OF_LIFE_POSITIONS = [
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

const normalize = (positions: string[]) => positions.map((p) => p.trim().toLowerCase());

export const isTreeOfLife = (positions: string[]) =>
  TREE_OF_LIFE_POSITIONS.every((pos) => normalize(positions).includes(pos));

const Reading: React.FC<ReadingProps> = React.memo(({
  selectedCards,
  positions,
  question,
  isComplete = false,
  significatorResult,
  onCardSelect,
}) => {
  const useKabbalahLayout = isTreeOfLife(positions);
  const useSignificatorsLayout = isSignificators(positions);
  const useRelationshipLayout = isRelationship(positions);

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
            className="text-xl sm:text-2xl text-[#e6d5b8] mt-2 italic max-w-2xl mx-auto px-4 whitespace-pre-wrap"
            style={{ fontFamily: "'Crimson Pro', serif" }}
          >
            &ldquo;{question}&rdquo;
          </p>
          <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-[#d4af37]/50 to-transparent mx-auto mt-4" />
        </div>
      )}

      {useSignificatorsLayout ? (
        <SignificatorsLayout significatorResult={significatorResult} />
      ) : useKabbalahLayout ? (
        <KabbalahLayout selectedCards={selectedCards} positions={positions} onCardSelect={onCardSelect} />
      ) : useRelationshipLayout ? (
        <RelationshipLayout selectedCards={selectedCards} positions={positions} onCardSelect={onCardSelect} />
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

                <TarotCard
                  card={card}
                  small={false}
                  showMeaning={isComplete}
                  onSelect={
                    onCardSelect &&
                    (() => onCardSelect({ card, reversed: card.reversed, position: positions[i] }))
                  }
                />
              </div>
            ))}
          </div>

          {/* Mystical divider */}
          <div className="flex items-center justify-center gap-4 my-8">
            <div className="w-12 h-0.5 bg-gradient-to-r from-transparent to-[#d4af37]/50" />
            <span className="text-[#d4af37] text-xl">✦</span>
            <div className="w-12 h-0.5 bg-gradient-to-l from-transparent to-[#d4af37]/50" />
          </div>
        </>
      )}
    </div>
  );
});

Reading.displayName = 'Reading';

export default Reading;
