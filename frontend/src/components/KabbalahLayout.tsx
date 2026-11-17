import React, { useCallback } from "react";
import TarotCard from "./TarotCard";
import type { SelectedCard, SpreadCardSelectHandler } from "@/types/reading";

interface KabbalahLayoutProps {
  selectedCards: SelectedCard[];
  positions: string[];
  onCardSelect?: SpreadCardSelectHandler;
}

// Get card by position name (handles the space in " Chesed")
const getCardByPosition = (
  selectedCards: SelectedCard[],
  positions: string[],
  posName: string
): SelectedCard | undefined => {
  // Find the index of the position name in the positions array
  const idx = positions.findIndex(
    (p) => p.trim().toLowerCase() === posName.toLowerCase()
  );
  return idx >= 0 ? selectedCards[idx] : undefined;
};

interface CardSlotProps {
  card?: SelectedCard;
  position: string;
  pillar?: "left" | "middle" | "right";
  onCardSelect?: SpreadCardSelectHandler;
}

const CardSlot: React.FC<CardSlotProps> = ({ card, position, onCardSelect }) => {
  if (!card) return null;

  return (
    <div className="flex flex-col items-center reading-card-reveal">
      {/* Position label */}
      <div className="text-center mb-2">
        <span
          className="text-xs text-[#d4af37]/70 tracking-widest"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          {position.toUpperCase()}
        </span>
      </div>
      <TarotCard
        card={card}
        small={true}
        showMeaning={false}
        position={position}
        onSelect={onCardSelect}
      />
    </div>
  );
};

const KabbalahLayout: React.FC<KabbalahLayoutProps> = ({
  selectedCards,
  positions,
  onCardSelect,
}) => {
  // Helper to get card for a position
  const getCard = (posName: string) =>
    getCardByPosition(selectedCards, positions, posName);

  // The layout names its slots canonically ("Chesed"); callers key their position data by
  // the spread's own string (which may carry stray whitespace), so hand that one back
  const handleSelect = useCallback<SpreadCardSelectHandler>(
    (selection) => {
      const raw = positions.find(
        (p) => p.trim().toLowerCase() === selection.position?.toLowerCase()
      );
      onCardSelect?.({ ...selection, position: raw ?? selection.position });
    },
    [positions, onCardSelect]
  );
  const slotHandler = onCardSelect && handleSelect;

  return (
    <div className="w-full">
      {/* Single responsive Tree of Life layout */}
      <div className="flex flex-col items-center gap-2 md:gap-4">
        {/* Row 1: Kether (Crown) */}
        <div className="flex justify-center">
          <CardSlot card={getCard("Kether")} position="Kether" pillar="middle" onCardSelect={slotHandler} />
        </div>

        {/* Row 2: Binah - Chokmah */}
        <div className="flex justify-center gap-8 md:gap-24">
          <CardSlot card={getCard("Binah")} position="Binah" pillar="left" onCardSelect={slotHandler} />
          <CardSlot card={getCard("Chokmah")} position="Chokmah" pillar="right" onCardSelect={slotHandler} />
        </div>

        {/* Row 3: Daath (Hidden/Knowledge) */}
        <div className="flex justify-center opacity-80">
          <CardSlot card={getCard("Daath")} position="Daath" pillar="middle" onCardSelect={slotHandler} />
        </div>

        {/* Row 4: Geburah - Chesed */}
        <div className="flex justify-center gap-8 md:gap-24">
          <CardSlot card={getCard("Geburah")} position="Geburah" pillar="left" onCardSelect={slotHandler} />
          <CardSlot card={getCard("Chesed")} position="Chesed" pillar="right" onCardSelect={slotHandler} />
        </div>

        {/* Row 5: Tiphereth (Beauty) */}
        <div className="flex justify-center">
          <CardSlot
            card={getCard("Tiphereth")}
            position="Tiphereth"
            pillar="middle"
            onCardSelect={slotHandler}
          />
        </div>

        {/* Row 6: Hod - Netzach */}
        <div className="flex justify-center gap-8 md:gap-24">
          <CardSlot card={getCard("Hod")} position="Hod" pillar="left" onCardSelect={slotHandler} />
          <CardSlot card={getCard("Netzach")} position="Netzach" pillar="right" onCardSelect={slotHandler} />
        </div>

        {/* Row 7: Yesod (Foundation) */}
        <div className="flex justify-center">
          <CardSlot card={getCard("Yesod")} position="Yesod" pillar="middle" onCardSelect={slotHandler} />
        </div>

        {/* Row 8: Malkuth (Kingdom) */}
        <div className="flex justify-center">
          <CardSlot card={getCard("Malkuth")} position="Malkuth" pillar="middle" onCardSelect={slotHandler} />
        </div>
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
          The Tree of Life reveals the divine emanations of your situation. The
          three pillars represent Severity, Equilibrium, and Mercy - contemplate
          how these forces interact in your reading.
        </p>
      </div>
    </div>
  );
};

export default KabbalahLayout;
