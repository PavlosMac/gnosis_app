import React, { useMemo } from "react";
import { MANUAL_DECK_ORDER } from "@/lib/cards";
import type { SelectedCard } from "@/types/reading";

interface FaceUpDeckProps {
  numCards: number;
  positions: string[];
  selectedCards: SelectedCard[];
  onAddCard: (card: SelectedCard) => void;
  onRemoveCard: (cardIdx: number) => void;
  onToggleOrientation: (cardIdx: number) => void;
  onComplete: () => void;
  onCancel: () => void;
}

const CINZEL = { fontFamily: "'Cinzel', serif" } as const;
const CRIMSON = { fontFamily: "'Crimson Pro', serif" } as const;

const CARD_BUTTON = 'relative group overflow-visible z-0 active:z-50 sm:hover:z-50 transition-[z-index] duration-0';
const CARD_FRAME = 'relative card-flip-container rounded-sm overflow-hidden border bg-[#f5f5dc] transition-transform duration-300';
const CARD_FRAME_SELECTED = 'border-[#d4af37] ring-2 ring-[#d4af37] shadow-[0_0_12px_rgba(212,175,55,0.7)]';
const CARD_FRAME_IDLE = 'border-[#d4af37]/40 shadow-md';

const FaceUpDeck: React.FC<FaceUpDeckProps> = React.memo(({
  numCards,
  positions,
  selectedCards,
  onAddCard,
  onRemoveCard,
  onToggleOrientation,
  onComplete,
  onCancel,
}) => {
  const isComplete = selectedCards.length >= numCards;
  const nextPosition = positions[selectedCards.length];
  // idx → position slot, so the 78-card grid does one lookup per card instead of a scan
  const pickedAt = useMemo(
    () => new Map(selectedCards.map((c, i) => [c.idx, i])),
    [selectedCards]
  );

  return (
    <div className="w-full">
      {/* Sticky tray — progress, picked cards, actions */}
      <div
        className="sticky top-0 z-10 -mx-1 sm:mx-0 mb-3 sm:mb-6 px-2 sm:px-4 py-3 sm:py-4 rounded-b-lg sm:rounded-lg
                   border-b sm:border border-[#d4af37]/30 backdrop-blur-sm shadow-lg"
        style={{ background: 'linear-gradient(180deg, rgba(26,0,51,0.97) 0%, rgba(45,27,78,0.95) 100%)' }}
      >
        <p
          className="text-center text-[#e6d5b8] text-sm sm:text-base tracking-wide mb-3"
          style={CRIMSON}
          aria-live="polite"
        >
          {isComplete
            ? 'All cards chosen — reverse or remove any card below, then reveal'
            : `Choose card ${selectedCards.length + 1} of ${numCards} — ${nextPosition}`}
        </p>

        <ul className="flex flex-wrap justify-center gap-3 sm:gap-4 min-h-[5.5rem] sm:min-h-[6.5rem] mb-4" aria-label="Chosen cards">
          {selectedCards.map((card, i) => (
            <li
              key={card.idx}
              className="flex items-center gap-3 pl-1.5 pr-3 py-1.5 rounded-lg border border-[#d4af37]/40 bg-[#0a0015]/60"
            >
              <img
                src={card.imageUrl}
                alt=""
                className={`w-12 h-[76px] sm:w-14 sm:h-[90px] object-cover rounded-sm border border-[#d4af37]/60 transition-transform duration-300 ${card.reversed ? 'rotate-180' : ''}`}
                loading="eager"
              />
              <div className="flex flex-col min-w-0">
                <span className="text-xs sm:text-sm text-[#d4af37]/70 uppercase tracking-wider truncate" style={CINZEL}>
                  {i + 1}. {positions[i]}
                </span>
                <span className="text-sm sm:text-lg text-[#e6d5b8] truncate" style={CRIMSON}>
                  {card.name}{card.reversed ? ' (reversed)' : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onToggleOrientation(card.idx)}
                aria-pressed={card.reversed}
                aria-label={`Reverse ${card.name}`}
                title={card.reversed ? 'Set upright' : 'Set reversed'}
                className={`ml-1 w-8 h-8 sm:w-9 sm:h-9 rounded border text-base leading-none transition-colors
                  ${card.reversed
                    ? 'border-[#d4af37] bg-[#d4af37]/20 text-[#d4af37] ring-1 ring-[#d4af37]'
                    : 'border-[#d4af37]/40 text-[#d4af37]/70 hover:text-[#d4af37] hover:border-[#d4af37]'}`}
              >
                <span aria-hidden="true" className="inline-block">⤾</span>
              </button>
              <button
                type="button"
                onClick={() => onRemoveCard(card.idx)}
                aria-label={`Remove ${card.name}`}
                title="Remove"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded border border-[#d4af37]/40 text-[#e6d5b8]/60 hover:text-red-300 hover:border-red-300/60 text-base leading-none transition-colors"
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        <div className="relative flex items-center justify-center min-h-[2.5rem]">
          <button
            type="button"
            onClick={onComplete}
            disabled={!isComplete}
            className="px-4 sm:px-6 py-2 bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] rounded-lg
                       shadow-md hover:shadow-[#d4af37]/50 transition-all duration-300 font-bold text-xs sm:text-sm
                       hover:scale-105 active:scale-95 border border-[#d4af37]/50
                       disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
            style={{ ...CINZEL, letterSpacing: '0.1em' }}
          >
            ✦ Show Reading ✦
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="absolute right-0 top-1/2 -translate-y-1/2 text-[#d4af37]/50 hover:text-[#d4af37]/80 transition-colors text-xs sm:text-sm tracking-widest select-none"
            style={CINZEL}
          >
            &#9671; Go Back &#9671;
          </button>
        </div>
      </div>

      {/* Face-up deck grid — same footprint as ShuffledDeck */}
      <div className="w-full px-1 sm:px-1 flex items-start">
        <div className="flex flex-wrap justify-center gap-x-[2px] gap-y-[2px] sm:gap-y-[1px] mx-auto w-full max-w-[400px] sm:max-w-[856px]">
          {MANUAL_DECK_ORDER.map((card) => {
            const slot = pickedAt.get(card.idx);
            const selected = slot === undefined ? undefined : selectedCards[slot];
            const disabled = !selected && isComplete;
            const label = selected
              ? `${card.name} — selected for ${positions[slot!]}${selected.reversed ? ', reversed' : ''}`
              : card.name;
            return (
              <button
                key={card.idx}
                type="button"
                onClick={() => (selected ? onRemoveCard(card.idx) : onAddCard({ ...card, reversed: false }))}
                disabled={disabled}
                aria-pressed={!!selected}
                aria-label={label}
                title={label}
                className={`${CARD_BUTTON} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
              >
                {!selected && !disabled && (
                  <div className="absolute -inset-0.5 sm:-inset-1 bg-gradient-to-r from-[#d4af37] via-[#8a2be2] to-[#d4af37]
                                  rounded-lg opacity-0 sm:group-hover:opacity-70 group-active:opacity-90 transition-all duration-300 pointer-events-none" />
                )}
                <div
                  className={`${CARD_FRAME} ${disabled ? '' : 'sm:group-hover:scale-115 group-active:scale-95'} ${selected ? CARD_FRAME_SELECTED : CARD_FRAME_IDLE}`}
                >
                  <img
                    src={card.imageUrl}
                    alt=""
                    className={`w-full h-full object-cover ${selected ? 'opacity-50' : ''}`}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});

FaceUpDeck.displayName = 'FaceUpDeck';

export default FaceUpDeck;
