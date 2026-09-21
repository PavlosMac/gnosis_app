import React from "react";
import TarotCard from "@/components/TarotCard";
import KabbalahLayout from "@/components/KabbalahLayout";
import RelationshipLayout from "@/components/RelationshipLayout";
import { isTreeOfLife, isRelationship } from "@/components/Reading";
import type { TarotCardData } from "@/types/models";
import type { SelectedCard } from "@/types/reading";
import { basePosition, isSignificators } from "@/lib/significator-positions";

// Saved significator charts: one banner per group, laid out in rows like the live chart.
const SIGNIFICATOR_ROWS = [
  [
    { base: "day number", title: "Day Number" },
    { base: "star sign", title: "Star Sign" },
  ],
  [{ base: "life number", title: "Life Numbers" }],
  [
    { base: "decanate", title: "Decanate" },
    { base: "court royal", title: "Court Royal" },
  ],
] as const;

// Positions matching no row above still show, so a saved card is never dropped silently.
const OTHER_GROUP = { base: "other", title: "Other" } as const;
const KNOWN_BASES: string[] = SIGNIFICATOR_ROWS.flatMap((row) => row.map((g) => g.base));

export type CardVisuals = Record<string, { card: TarotCardData; reversed: boolean } | null>;

interface SpreadCardsProps {
  cardVisuals: CardVisuals;
}

const SignificatorGroups: React.FC<SpreadCardsProps> = ({ cardVisuals }) => {
  const entries = Object.entries(cardVisuals);
  const groupOf = (position: string) => {
    const base = basePosition(position.trim().toLowerCase());
    return KNOWN_BASES.includes(base) ? base : OTHER_GROUP.base;
  };
  const cardsFor = (base: string) =>
    entries.flatMap(([position, visual]) => (groupOf(position) === base ? [{ position, visual }] : []));
  const rows: readonly (readonly { base: string; title: string }[])[] = [
    ...SIGNIFICATOR_ROWS,
    [OTHER_GROUP],
  ];

  return (
    <div className="flex flex-col items-center gap-8">
      {rows.map((row) => {
        const groups = row
          .map((group) => ({ ...group, cards: cardsFor(group.base) }))
          .filter((group) => group.cards.length > 0);
        if (groups.length === 0) return null;
        return (
          <div key={row[0].base} className="flex flex-wrap justify-center gap-4">
            {groups.map(({ base, title, cards }) => (
              <section key={base} className="flex flex-col items-center gap-2 px-2 sm:px-4">
                <h4
                  className="text-xs text-[#d4af37]/80 tracking-widest uppercase text-center whitespace-nowrap"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {title}
                </h4>
                <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#d4af37]/50 to-transparent mb-2" />
                {/* Fixed-width slots: long names wrap under the card, so three fit a phone */}
                <div className="flex flex-wrap justify-center gap-3">
                  {cards.map(({ position, visual }) => (
                    <div key={position} className="w-20 sm:w-28">
                      {visual ? (
                        <TarotCard
                          card={{ ...visual.card, reversed: visual.reversed }}
                          small={true}
                          showMeaning={false}
                        />
                      ) : (
                        <span
                          className="block text-xs text-[#e6d5b8]/60 text-center"
                          style={{ fontFamily: "'Cinzel', serif" }}
                        >
                          {position}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        );
      })}
    </div>
  );
};

/** The saved spread, laid out as in the game: Tree of Life as a tree, Relationship as 3×3 pillars, everything else as a row. Card image + position label only, no text.
 * Positions come from `cardVisuals`' own keys — the single source of truth for
 * "which positions does this spread have", so callers can't derive a mismatched list. */
const SpreadCards: React.FC<SpreadCardsProps> = ({ cardVisuals }) => {
  const positions = Object.keys(cardVisuals);
  const isTree = isTreeOfLife(positions);
  if (isSignificators(positions)) {
    return <SignificatorGroups cardVisuals={cardVisuals} />;
  }
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
