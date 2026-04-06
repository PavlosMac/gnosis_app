"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Reading from "@/components/Reading";
import ShuffledDeck from "@/components/ShuffledDeck";
import ShuffleAnimation from "@/components/ShuffleAnimation";
import InterpretationModal from "@/components/InterpretationModal";
import OrnateFrame from "@/components/OrnateFrame";
import readingsConfig from "@/lib/readings-config.json";

import { useGameReducer, getSelectedCards, getReading } from "@/hooks/useGameReducer";
import type { User } from "@/types/auth";
import type { SelectedCard } from "@/types/reading";
import type { InterpretResult } from "@/types/interpret";

interface PositionConfig {
  name: string;
  description: string;
}

interface ReadingConfig {
  name: string;
  description: string;
  cards: number;
  positions: PositionConfig[];
  showQuestion?: boolean;
  meta?: {
    field: string;
    placeholder: string;
    button: string;
  };
}

interface TarotGameProps {
  user?: User | null;
}

const readings = readingsConfig.readings as ReadingConfig[];

// Animation timing constants (in ms)
const CARD_FLIP_DURATION = 600; // matches CSS .card-flip-inner transition
const CARD_FLIP_BUFFER = 200;
const SHOW_READING_DELAY = CARD_FLIP_DURATION + CARD_FLIP_BUFFER;
const DECK_SCROLL_DELAY = 300;
const READING_SCROLL_DELAY = 100;

export default function TarotGame({ user }: TarotGameProps) {
  const [selectedReading, setSelectedReading] = useState<ReadingConfig>(readings[1]);
  const [userQuestion, setUserQuestion] = useState<string>("");
  const [showInterpretModal, setShowInterpretModal] = useState(false);
  const [interpretResult, setInterpretResult] = useState<InterpretResult | null>(null);
  const [game, dispatch] = useGameReducer();
  const deckRef = useRef<HTMLDivElement>(null);
  const readingRef = useRef<HTMLDivElement>(null);

  const numCards = selectedReading.cards;
  const selectedCards = getSelectedCards(game);
  const completedReading = getReading(game);
  const isSelecting = game.phase !== 'setup' && game.phase !== 'shuffling';

  const positionNames = selectedReading.positions.map(p => p.name);
  const positionDescriptions = Object.fromEntries(
    selectedReading.positions.map(p => [p.name, p.description])
  );

  const startGame = () => dispatch({ type: 'START_SHUFFLE' });

  const handleShuffleComplete = useCallback(() => {
    dispatch({ type: 'SHUFFLE_COMPLETE' });
  }, []);

  const handleSelectCard = (card: SelectedCard) => {
    dispatch({
      type: 'SELECT_CARD',
      card,
      numCards,
      positions: positionNames,
      readingName: selectedReading.name,
      question: selectedReading.showQuestion ? (userQuestion || undefined) : undefined,
      positionDescriptions,
    });
  };

  const handleNewReading = () => {
    dispatch({ type: 'RESET' });
    setShowInterpretModal(false);
    setInterpretResult(null);
  };

  const handleCloseModal = useCallback(() => setShowInterpretModal(false), []);

  const handleResultReceived = useCallback((r: InterpretResult) => {
    setInterpretResult(r);
  }, []);

  // Scroll the deck into view when the spread appears (after shuffle)
  useEffect(() => {
    if (game.phase === 'selecting' && deckRef.current) {
      const timer = setTimeout(() => {
        deckRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, DECK_SCROLL_DELAY);
      return () => clearTimeout(timer);
    }
  }, [game.phase]);

  // Show reading after card flip animation completes
  useEffect(() => {
    if (game.phase === 'flipping') {
      const timer = setTimeout(() => {
        dispatch({ type: 'FLIP_COMPLETE' });
      }, SHOW_READING_DELAY);
      return () => clearTimeout(timer);
    }
  }, [game.phase]);

  // Scroll to reading when it becomes visible
  useEffect(() => {
    if (game.phase === 'reading' && readingRef.current) {
      const timer = setTimeout(() => {
        readingRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, READING_SCROLL_DELAY);
      return () => clearTimeout(timer);
    }
  }, [game.phase]);

  return (
    <div className="relative w-full max-w-6xl mx-auto overflow-hidden rounded-xl border-2 border-[#d4af37]/30 shadow-2xl"
         style={{
           background: 'linear-gradient(135deg, rgba(26,0,51,0.95) 0%, rgba(45,27,78,0.95) 100%)',
         }}>
      {/* Backdrop blur isolated to inner layer so it doesn't create a compositing layer on the outer div */}
      <div className="absolute inset-0 pointer-events-none" style={{ backdropFilter: 'blur(10px)' }} />

      {/* Ornate corner decorations */}
      <OrnateFrame />

      {/* Mystical glow effect */}
      <div className="absolute inset-0 opacity-30 pointer-events-none"
           style={{
             background: 'radial-gradient(circle at 50% 50%, rgba(212,175,55,0.15), transparent 70%)'
           }} />

      {/* Content */}
      <div className={`relative z-10 ${isSelecting ? 'p-1 sm:p-12' : 'p-6 sm:p-12'}`}>
        <h1 className={`text-4xl sm:text-6xl font-bold mb-2 text-center text-[#d4af37] tracking-wider ${isSelecting ? 'hidden sm:block' : ''}`}
            style={{ fontFamily: "'Cinzel', serif", textShadow: '0 0 20px rgba(212,175,55,0.5)' }}>
          Reading Oracle
        </h1>

        <p className={`text-center text-[#d4af37]/70 mb-8 text-sm sm:text-base tracking-wide ${isSelecting ? 'hidden sm:block' : ''}`}
           style={{ fontFamily: "'Crimson Pro', serif" }}>
          ✦ Unveil the Mysteries of Your Path ✦
        </p>

        {/* Pre-game selection screen */}
        {game.phase === 'setup' && (
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
                if (reading) {
                  setSelectedReading(reading);
                  setUserQuestion("");
                }
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
        {game.phase === 'shuffling' && (
          <ShuffleAnimation onComplete={handleShuffleComplete} />
        )}

        {/* Game in progress - deck and card selection */}
        {isSelecting && (
          <div ref={deckRef}>
            <div className="mb-1 sm:mb-6 text-center hidden sm:block">
              <span className="font-semibold text-[#e6d5b8] text-lg tracking-wide"
                    style={{ fontFamily: "'Crimson Pro', serif" }}>
                Select {numCards} card{numCards > 1 ? 's' : ''} from the sacred deck
              </span>
            </div>

            {/* Shuffled Deck — single responsive component */}
            <div className="flex justify-center mb-2 sm:mb-8 animate-fadeIn">
              <ShuffledDeck
                numCards={numCards}
                selectedCards={selectedCards}
                onSelectCard={handleSelectCard}
              />
            </div>

            {/* Reading component - shows after card flip animation completes */}
            {game.phase === 'reading' && (
              <div ref={readingRef} className="mt-10 flex justify-center animate-fadeIn">
                <Reading
                  selectedCards={selectedCards}
                  positions={positionNames}
                  question={selectedReading.showQuestion ? userQuestion : undefined}
                  isComplete={selectedCards.length === numCards}
                />
              </div>
            )}

            {selectedCards.length === numCards && (
              <div className="flex flex-col items-center gap-4 mt-10">
                <button
                  className="px-10 py-4 bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] rounded-lg
                             shadow-lg hover:shadow-[#d4af37]/50 transition-all duration-300 font-bold text-lg
                             hover:scale-105 active:scale-95 border border-[#d4af37]/50"
                  style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.1em' }}
                  onClick={handleNewReading}
                >
                  ✦ New Reading ✦
                </button>

                {user && user.isSuperadmin && (
                  <button
                    className="px-10 py-4 bg-gradient-to-br from-[#8a2be2]/80 to-[#5a1a9e]/80 text-[#e6d5b8] rounded-lg
                               shadow-lg hover:shadow-[#8a2be2]/40 transition-all duration-300 font-bold text-lg
                               hover:scale-105 active:scale-95 border border-[#8a2be2]/40"
                    style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.1em' }}
                    onClick={() => setShowInterpretModal(true)}
                  >
                    ✦ Oracle Interpretation ✦
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showInterpretModal && completedReading && (
        <InterpretationModal
          reading={completedReading}
          onClose={handleCloseModal}
          initialResult={interpretResult}
          onResultReceived={handleResultReceived}
        />
      )}
    </div>
  );
}
