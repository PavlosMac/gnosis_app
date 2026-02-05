import { useEffect, useRef, useState } from "react";
import { TarotCardData } from "../models";
import { TAROT_DECK } from "../utils/cards";
import { secureShuffleArray, getSecureRandomBoolean } from "@/lib/crypto-random";

interface SelectedCard extends TarotCardData {
  idx: number;
  reversed: boolean;
}

interface ShuffledDeckMobileProps {
  numCards: number;
  selectedCards: SelectedCard[];
  onSelectCard: (card: SelectedCard) => void;
}

export default function ShuffledDeckMobile({ numCards, selectedCards, onSelectCard }: ShuffledDeckMobileProps) {
  const [shuffledDeck, setShuffledDeck] = useState<TarotCardData[]>([]);
  const deckRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShuffledDeck(secureShuffleArray(TAROT_DECK));
  }, [numCards]);

  useEffect(() => {
    if (shuffledDeck.length > 0 && deckRef.current) {
      deckRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [shuffledDeck]);

  const handleSelect = (idx: number) => {
    if (selectedCards.length >= numCards) return;
    if (selectedCards.find((c) => c.idx === idx)) return;
    const reversed = getSecureRandomBoolean();
    onSelectCard({ ...shuffledDeck[idx], idx, reversed });
  };

  return (
    <div ref={deckRef} className="w-full px-1 flex items-start">
      <div className="flex flex-wrap justify-center gap-x-[2px] gap-y-[2px] mx-auto w-full max-w-[400px]">
        {shuffledDeck.slice(0, 78).map((card, idx) => {
          const selected = selectedCards.find((c) => c.idx === idx);
          return (
            <button
              key={idx}
              className={`relative group ${selected ? 'selected' : ''} overflow-visible z-0 active:z-50`}
              onClick={() => handleSelect(idx)}
              disabled={!!selected || selectedCards.length >= numCards}
              aria-label={`Pick card ${idx + 1}`}
              style={{ perspective: '600px' }}
            >
              {/* Card glow on active */}
              {!selected && (
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[#d4af37] via-[#8a2be2] to-[#d4af37]
                                rounded-lg opacity-0 group-active:opacity-90 blur transition-all duration-300 pointer-events-none" />
              )}

              {/* Flip container - original mobile sizing */}
              <div className={`relative card-flip-inner ${selected ? 'card-flipped' : ''}`}
                   style={{ width: 'clamp(32px, 9vw, 64px)', height: 'clamp(40px, 10.5dvh, 112px)' }}>
                {/* Back face (ankh) */}
                <div className="card-flip-face card-flip-back absolute inset-0 bg-gradient-to-br from-[#1a0033] to-[#2d1b4e]
                                rounded-sm border border-[#d4af37]/60 shadow-lg overflow-hidden
                                transition-all duration-300
                                group-active:border-[#ffd700] group-active:shadow-[0_0_15px_rgba(212,175,55,0.6)]">

                  <div className="absolute inset-0 flex items-center justify-center opacity-60 group-active:opacity-100 transition-opacity">
                    <svg className="w-[60%] h-[70%]" viewBox="0 0 40 64" fill="none">
                      <circle cx="20" cy="14" r="10" stroke="rgba(212,175,55,0.7)" strokeWidth="2.5" fill="none"/>
                      <line x1="20" y1="24" x2="20" y2="60" stroke="rgba(212,175,55,0.7)" strokeWidth="3"/>
                      <line x1="6" y1="32" x2="34" y2="32" stroke="rgba(212,175,55,0.7)" strokeWidth="3"/>
                      <circle cx="20" cy="14" r="10" stroke="rgba(212,175,55,0.2)" strokeWidth="1" fill="rgba(212,175,55,0.05)"/>
                    </svg>
                  </div>

                  <div className="absolute top-0.5 left-0.5 text-[#d4af37]/40 text-[0.25em]">✦</div>
                  <div className="absolute top-0.5 right-0.5 text-[#d4af37]/40 text-[0.25em]">✦</div>
                  <div className="absolute bottom-0.5 left-0.5 text-[#d4af37]/40 text-[0.25em]">✦</div>
                  <div className="absolute bottom-0.5 right-0.5 text-[#d4af37]/40 text-[0.25em]">✦</div>

                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-[#d4af37]/10 to-transparent
                                  opacity-0 group-active:opacity-100 transition-opacity duration-500" />
                </div>

                {/* Front face (card image) */}
                <div className="card-flip-face card-flip-front absolute inset-0 rounded-sm overflow-hidden border border-[#d4af37] shadow-[0_0_10px_rgba(212,175,55,0.4)] bg-[#f5f5dc]">
                  {selected && (
                    <img
                      src={selected.imageUrl}
                      alt={selected.name}
                      className={`w-full h-full object-cover ${selected.reversed ? 'rotate-180' : ''}`}
                      loading="eager"
                    />
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
