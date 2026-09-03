import React from "react";
import TarotCard from "@/components/TarotCard";
import KabbalahLayout from "@/components/KabbalahLayout";
import RelationshipLayout from "@/components/RelationshipLayout";
import { isTreeOfLife, isRelationship } from "@/components/Reading";
import type { TarotCardData } from "@/types/models";
import type { SelectedCard } from "@/types/reading";

export type CardVisuals = Record<string, { card: TarotCardData; reversed: boolean } | null>;

interface SpreadCardsProps {
  cardVisuals: CardVisuals;
}

/** The saved spread, laid out as in the game: Tree of Life as a tree, Relationship as 3×3 pillars, everything else as a row. Card image + position label only, no text.
 * Positions come from `cardVisuals`' own keys — the single source of truth for
 * "which positions does this spread have", so callers can't derive a mismatched list. */
const SpreadCards: React.FC<SpreadCardsProps> = ({ cardVisuals }) => {
  const positions = Object.keys(cardVisuals);
  const isTree = isTreeOfLife(positions);
  if (isTree || isRelationship(positions)) {
    const selectedCards = positions.map((position, i) => {
      const visual = cardVisuals[position];
      return visual ? ({ ...visual.card, idx: i, reversed: visual.reversed } as SelectedCard) : undefined;
    });
    // Kabbalah looks cards up by name and Relationship by pillar suffix, so skipping unresolved cards is safe
    const known = selectedCards.flatMap((c, i) => (c ? [{ card: c, position: positions[i] }] : []));
    const Layout = isTree ? KabbalahLayout : RelationshipLayout;
    return (
      <Layout
        selectedCards={known.map((k) => k.card)}
        positions={known.map((k) => k.position)}
      />
    );
  }
  return (
    <div className="flex flex-wrap justify-center gap-6">
      {positions.map((position) => {
        const visual = cardVisuals[position];
        return (
          <div key={position} className="flex flex-col items-center gap-2">
            {visual && (
              <TarotCard
                card={{ ...visual.card, reversed: visual.reversed }}
                small={true}
                showMeaning={false}
              />
            )}
            <span
              className="text-xs text-[#e6d5b8]/60 text-center"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              {position}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default SpreadCards;
