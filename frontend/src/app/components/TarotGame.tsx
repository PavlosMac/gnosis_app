
"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Reading from "@/app/components/Reading";
import ShuffledDeck from "@/app/components/ShuffledDeck";
import ShuffledDeckMobile from "@/app/components/ShuffledDeckMobile";
import ShuffleAnimation from "@/app/components/ShuffleAnimation";
import { TarotCardData } from "../models";
import readingsConfig from "@/lib/readings-config.json";

// Hook to detect mobile screen
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

interface ReadingConfig {
  name: string;
  description: string;
  cards: number;
  positions: string[];
  showQuestion?: boolean;
  meta?: {
    field: string;
    placeholder: string;
    button: string;
  };
}

interface SelectedCard extends TarotCardData {
  idx: number;
  reversed: boolean;
}

interface ReadingResult {
  readingType: string;
  positions: Record<string, SelectedCard>;
  question?: string;
}

const readings = readingsConfig.readings as ReadingConfig[];

// Animation timing constants (in ms)
const CARD_FLIP_DURATION = 600; // matches CSS .card-flip-inner transition
const CARD_FLIP_BUFFER = 200;
const SHOW_READING_DELAY = CARD_FLIP_DURATION + CARD_FLIP_BUFFER;
const DECK_SCROLL_DELAY = 300;
const READING_SCROLL_DELAY = 100;

export default function TarotGame() {
  const [selectedReading, setSelectedReading] = useState<ReadingConfig>(readings[1]); // Default to Past, Present, Future
  const [userQuestion, setUserQuestion] = useState<string>("");
  const [selectedCards, setSelectedCards] = useState<SelectedCard[]>([]);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [isShuffling, setIsShuffling] = useState<boolean>(false);
  const [completedReading, setCompletedReading] = useState<ReadingResult | null>(null);
  const [showReading, setShowReading] = useState<boolean>(false);
  const deckRef = useRef<HTMLDivElement>(null);
  const readingRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const numCards = selectedReading.cards;

  const startGame = () => {
    setSelectedCards([]);
    setCompletedReading(null);
    setShowReading(false);
    setIsShuffling(true);
  };

  const handleShuffleComplete = useCallback(() => {
    setIsShuffling(false);
    setGameStarted(true);
  }, []);

  const handleSelectCard = (card: SelectedCard) => {
    setSelectedCards((prev) => [...prev, card]);
  };

  const handleNewReading = () => {
    setGameStarted(false);
    setIsShuffling(false);
    setSelectedCards([]);
    setCompletedReading(null);
    setShowReading(false);
  };

  // Auto-capture reading when all cards are selected
  useEffect(() => {
    if (selectedCards.length === numCards && numCards > 0 && !completedReading) {
      // Map each card to its position label
      const positions = selectedReading.positions.reduce((acc, position, idx) => {
        if (selectedCards[idx]) {
          acc[position] = selectedCards[idx];
        }
        return acc;
      }, {} as Record<string, SelectedCard>);

      const result: ReadingResult = {
        readingType: selectedReading.name,
        positions,
        ...(userQuestion && { question: userQuestion }),
      };
      setCompletedReading(result);
      console.log("Reading captured:", result);
    }
  }, [selectedCards, numCards, completedReading, selectedReading, userQuestion]);

  // Scroll the deck into view when the spread appears (after shuffle)
  useEffect(() => {
    if (gameStarted && deckRef.current) {
      const timer = setTimeout(() => {
        if (gameStarted && deckRef.current) {
          deckRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, DECK_SCROLL_DELAY);
      return () => clearTimeout(timer);
    }
  }, [gameStarted]);

  // Show reading after card flip animation completes
  useEffect(() => {
    if (selectedCards.length === numCards && numCards > 0 && !showReading) {
      const timer = setTimeout(() => {
        setShowReading(true);
      }, SHOW_READING_DELAY);
      return () => clearTimeout(timer);
    }
  }, [selectedCards.length, numCards, showReading]);

  // Scroll to reading when it becomes visible
  useEffect(() => {
    if (showReading && readingRef.current) {
      const timer = setTimeout(() => {
        if (showReading && readingRef.current) {
          readingRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }, READING_SCROLL_DELAY);
      return () => clearTimeout(timer);
    }
  }, [showReading]);

  return (
    <div className="relative w-full max-w-6xl mx-auto overflow-hidden rounded-xl border-2 border-[#d4af37]/30 shadow-2xl"
         style={{
           background: 'linear-gradient(135deg, rgba(26,0,51,0.95) 0%, rgba(45,27,78,0.95) 100%)',
           backdropFilter: 'blur(10px)',
         }}>

      {/* Ornate corner decorations */}
      <div className="absolute top-0 left-0 w-24 h-24 border-t-2 border-l-2 border-[#d4af37]/50 rounded-tl-xl" />
      <div className="absolute top-0 right-0 w-24 h-24 border-t-2 border-r-2 border-[#d4af37]/50 rounded-tr-xl" />
      <div className="absolute bottom-0 left-0 w-24 h-24 border-b-2 border-l-2 border-[#d4af37]/50 rounded-bl-xl" />
      <div className="absolute bottom-0 right-0 w-24 h-24 border-b-2 border-r-2 border-[#d4af37]/50 rounded-br-xl" />

      {/* Mystical glow effect */}
      <div className="absolute inset-0 opacity-30 pointer-events-none"
           style={{
             background: 'radial-gradient(circle at 50% 50%, rgba(212,175,55,0.15), transparent 70%)'
           }} />

      {/* Content */}
      <div className={`relative z-10 ${gameStarted && !isShuffling ? 'p-1 sm:p-12' : 'p-6 sm:p-12'}`}>
        <h1 className={`text-4xl sm:text-6xl font-bold mb-2 text-center text-[#d4af37] tracking-wider ${gameStarted && !isShuffling ? 'hidden sm:block' : ''}`}
            style={{ fontFamily: "'Cinzel', serif", textShadow: '0 0 20px rgba(212,175,55,0.5)' }}>
          Reading Oracle
        </h1>

        <p className={`text-center text-[#d4af37]/70 mb-8 text-sm sm:text-base tracking-wide ${gameStarted && !isShuffling ? 'hidden sm:block' : ''}`}
           style={{ fontFamily: "'Crimson Pro', serif" }}>
          ✦ Unveil the Mysteries of Your Path ✦
        </p>

        {/* Pre-game selection screen */}
        {!gameStarted && !isShuffling && (
          <div className="flex flex-col items-center gap-6 mt-8 py-8">
            <label className="text-xl text-[#e6d5b8] tracking-wide"
                   style={{ fontFamily: "'Crimson Pro', serif" }}>
              Choose your reading type
            </label>

            <select
              className="border-2 border-[#d4af37]/50 rounded-lg px-6 py-3 bg-[#1a0033]/80 text-[#e6d5b8] text-lg backdrop-blur-sm
                         focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30 transition-all cursor-pointer"
              style={{ fontFamily: "'Crimson Pro', serif" }}
              value={selectedReading.name}
              onChange={(e) => {
                const reading = readings.find(r => r.name === e.target.value);
                if (reading) setSelectedReading(reading);
              }}
            >
              {readings.map((reading) => (
                <option key={reading.name} value={reading.name} className="bg-[#1a0033]">
                  {reading.name} ({reading.cards} {reading.cards === 1 ? 'Card' : 'Cards'})
                </option>
              ))}
            </select>

            <p className="text-[#e6d5b8]/70 text-xl text-center max-w-md"
               style={{ fontFamily: "'Crimson Pro', serif" }}>
              {selectedReading.description}
            </p>

            {selectedReading.meta?.field === "input" && (
              <input
                type="text"
                placeholder={selectedReading.meta.placeholder}
                value={userQuestion}
                onChange={(e) => setUserQuestion(e.target.value)}
                className="w-full max-w-md border-2 border-[#d4af37]/50 rounded-lg px-4 py-3 bg-[#1a0033]/80 text-[#e6d5b8] text-lg backdrop-blur-sm
                           focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30 transition-all placeholder:text-[#e6d5b8]/50"
                style={{ fontFamily: "'Crimson Pro', serif" }}
              />
            )}

            <button
              className="mt-6 px-10 py-4 bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] rounded-lg
                         shadow-lg hover:shadow-[#d4af37]/50 transition-all duration-300 font-bold text-lg
                         hover:scale-105 active:scale-95 border border-[#d4af37]/50"
              style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.1em' }}
              onClick={startGame}
            >
              ✦ Begin Your Journey ✦
            </button>
          </div>
        )}

        {/* Shuffle Animation */}
        {isShuffling && (
          <ShuffleAnimation onComplete={handleShuffleComplete} />
        )}

        {/* Game in progress - deck and card selection */}
        {gameStarted && !isShuffling && (
          <div ref={deckRef}>
            <div className="mb-1 sm:mb-6 text-center hidden sm:block">
              <span className="font-semibold text-[#e6d5b8] text-lg tracking-wide"
                    style={{ fontFamily: "'Crimson Pro', serif" }}>
                Select {numCards} card{numCards > 1 ? 's' : ''} from the sacred deck
              </span>
            </div>

            {/* Shuffled Deck - conditionally render mobile or desktop version */}
            <div className="flex justify-center mb-2 sm:mb-8 animate-fadeIn">
              {isMobile ? (
                <ShuffledDeckMobile
                  numCards={numCards}
                  selectedCards={selectedCards}
                  onSelectCard={handleSelectCard}
                />
              ) : (
                <ShuffledDeck
                  numCards={numCards}
                  selectedCards={selectedCards}
                  onSelectCard={handleSelectCard}
                />
              )}
            </div>

            {/* Reading component - shows after card flip animation completes */}
            {showReading && (
              <div ref={readingRef} className="mt-10 flex justify-center animate-fadeIn">
                <Reading
                  selectedCards={selectedCards}
                  positions={selectedReading.positions}
                  question={selectedReading.showQuestion ? userQuestion : undefined}
                  isComplete={selectedCards.length === numCards}
                />
              </div>
            )}

            {selectedCards.length === numCards && (
              <button
                className="mt-10 px-10 py-4 bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] rounded-lg
                           shadow-lg hover:shadow-[#d4af37]/50 transition-all duration-300 font-bold text-lg
                           hover:scale-105 active:scale-95 mx-auto block border border-[#d4af37]/50"
                style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.1em' }}
                onClick={handleNewReading}
              >
                ✦ New Reading ✦
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
