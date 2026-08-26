"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Reading from "@/components/Reading";
import ShuffledDeck from "@/components/ShuffledDeck";
import FaceUpDeck from "@/components/FaceUpDeck";
import ShuffleAnimation from "@/components/ShuffleAnimation";
import InterpretationModal from "@/components/InterpretationModal";
import LoginToInterpretModal from "@/components/LoginToInterpretModal";
import ReadingStyleModal from "@/components/ReadingStyleModal";
import OrnateFrame from "@/components/OrnateFrame";
import readingsConfig from "@/lib/readings-config.json";
import { parseAndValidateDate } from "@/lib/dateValidation";

import { useGameReducer, getSelectedCards, getReading, isPostDeal, isPickingCards, hasDeckOnScreen } from "@/hooks/useGameReducer";
import { createReading } from "@/app/user/interpret/actions";
import {
  DEFAULT_SETTINGS,
  readDefaultSettings,
  writeDefaultSettings,
} from "@/lib/interpretation-defaults";
import type { InterpretationSettings } from "@/types/interpret";
import { buildReadingPayload } from "@/lib/reading-payload";
import type { User } from "@/types/auth";
import type { SelectedCard } from "@/types/reading";
import type { TarotCardData } from "@/types/models";
import type { Interpretation } from "@/types/interpret";

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
  /** 'draw' shuffles and deals face-down; 'manual' shows the deck face-up so the user re-enters a physical spread */
  mode?: 'draw' | 'manual';
}

const readings = readingsConfig.readings as ReadingConfig[];
// Significators are birthdate-computed — nothing to enter by hand
const manualReadings = readings.filter((r) => r.cards > 0);
const DEFAULT_READING_NAME = readings[1].name;

// Animation timing constants (in ms)
const CARD_FLIP_DURATION = 600; // matches CSS .card-flip-inner transition
const CARD_FLIP_BUFFER = 200;
const SHOW_READING_DELAY = CARD_FLIP_DURATION + CARD_FLIP_BUFFER;
const DECK_SCROLL_DELAY = 300;
const READING_SCROLL_DELAY = 100;

export default function TarotGame({ user, mode = 'draw' }: TarotGameProps) {
  const router = useRouter();
  const isManual = mode === 'manual';
  const spreadOptions = isManual ? manualReadings : readings;
  const [selectedReading, setSelectedReading] = useState<ReadingConfig>(
    () => spreadOptions.find((r) => r.name === DEFAULT_READING_NAME) ?? spreadOptions[0]
  );
  const [allowReversals, setAllowReversals] = useState(false);
  const [userQuestion, setUserQuestion] = useState<string>("");
  const [showOracleInfo, setShowOracleInfo] = useState(false);
  const [showInterpretModal, setShowInterpretModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(!!user);
  const [savedReadingId, setSavedReadingId] = useState<string | null>(null);
  const [savingReading, setSavingReading] = useState(false);
  const [saveReadingError, setSaveReadingError] = useState<string | null>(null);
  const [savedInterpretations, setSavedInterpretations] = useState<Interpretation[]>([]);
  const [interpretationSettings, setInterpretationSettings] =
    useState<InterpretationSettings>(DEFAULT_SETTINGS);
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [game, dispatch] = useGameReducer();
  const deckRef = useRef<HTMLDivElement>(null);
  const readingRef = useRef<HTMLDivElement>(null);
  // Bumped on RESET so an in-flight createReading can't attach its id to the next reading
  const saveGenerationRef = useRef(0);
  // Seed reading style from the sticky default after mount (localStorage is
  // unavailable during SSR; a lazy initializer would cause a hydration mismatch)
  useEffect(() => {
    setInterpretationSettings(readDefaultSettings());
  }, []);

  // Persist when the style modal closes rather than on every slider tick, and
  // never from a mount effect (which would clobber the stored default)
  const handleCloseStyleModal = useCallback(() => {
    setShowStyleModal(false);
    writeDefaultSettings(interpretationSettings);
  }, [interpretationSettings]);

  const [day, setDay] = useState<string>("");
  const [month, setMonth] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [birthdateError, setBirthdateError] = useState<string | null>(null);

  const numCards = selectedReading.cards;
  const selectedCards = getSelectedCards(game);
  const completedReading = getReading(game);
  const isSelecting = isPostDeal(game);
  const isCompact = hasDeckOnScreen(game);
  const isReadingComplete = numCards > 0 ? selectedCards.length === numCards : selectedCards.length > 0;

  // Memoize derived state to prevent recalculation and stabilize references
  const positionNames = useMemo(
    () => selectedReading.positions.map(p => p.name),
    [selectedReading]
  );
  const positionDescriptions = useMemo(
    () => Object.fromEntries(selectedReading.positions.map(p => [p.name, p.description])),
    [selectedReading]
  );

  const startGame = () => {
    if (isManual) {
      dispatch({ type: 'START_MANUAL_ENTRY' });
    } else if (selectedReading.cards === 0) {
      dispatch({ type: 'START_BIRTHDATE_INPUT', readingName: selectedReading.name });
    } else {
      dispatch({ type: 'START_SHUFFLE' });
    }
  };

  const handleShuffleComplete = useCallback(() => {
    dispatch({ type: 'SHUFFLE_COMPLETE' });
  }, []);

  const handleSelectCard = useCallback((card: SelectedCard) => {
    dispatch({
      type: 'SELECT_CARD',
      card,
      numCards,
      positions: positionNames,
      readingName: selectedReading.name,
      question: selectedReading.showQuestion ? (userQuestion || undefined) : undefined,
      positionDescriptions,
    });
  }, [numCards, positionNames, selectedReading.name, selectedReading.showQuestion, userQuestion, positionDescriptions]);

  const handleManualAdd = useCallback((card: SelectedCard) => {
    dispatch({ type: 'MANUAL_ADD_CARD', card, numCards });
  }, [numCards]);

  const handleManualRemove = useCallback((cardIdx: number) => {
    dispatch({ type: 'MANUAL_REMOVE_CARD', cardIdx });
  }, []);

  const handleManualToggle = useCallback((cardIdx: number) => {
    dispatch({ type: 'MANUAL_TOGGLE_ORIENTATION', cardIdx });
  }, []);

  const handleManualComplete = useCallback(() => {
    dispatch({
      type: 'MANUAL_COMPLETE',
      positions: positionNames,
      readingName: selectedReading.name,
      question: selectedReading.showQuestion ? (userQuestion || undefined) : undefined,
      positionDescriptions,
    });
  }, [positionNames, selectedReading.name, selectedReading.showQuestion, userQuestion, positionDescriptions]);

  const handleNewReading = useCallback(() => {
    saveGenerationRef.current += 1;
    dispatch({ type: 'RESET' });
    setShowInterpretModal(false);
    setShowLoginModal(false);
    setSavedReadingId(null);
    setSaveReadingError(null);
    setSavingReading(false);
    setSavedInterpretations([]);
  }, []);

  const handleCloseModal = useCallback(() => setShowInterpretModal(false), []);

  const handleInterpretationSaved = useCallback(
    (saved: Interpretation, interpretations: Interpretation[]) => {
      setSavedInterpretations(interpretations);
      // Keep the reading style in step with settings tuned inside the modal
      // (the modal has already persisted them as the sticky default)
      setInterpretationSettings(saved.settings);
      // The journal entry is where saved interpretations are read and extended
      if (savedReadingId) router.push(`/user/readings/${savedReadingId}`);
    },
    [router, savedReadingId]
  );

  const handleCloseLoginModal = useCallback(() => setShowLoginModal(false), []);

  const saveReading = useCallback(async () => {
    if (!completedReading || savingReading || savedReadingId) return;
    const generation = saveGenerationRef.current;
    setSavingReading(true);
    setSaveReadingError(null);
    try {
      const result = await createReading(buildReadingPayload(completedReading));
      if (generation !== saveGenerationRef.current) return;
      if (result.ok) {
        setSavedReadingId(result.readingId);
      } else {
        setSaveReadingError(result.error);
      }
    } catch {
      if (generation !== saveGenerationRef.current) return;
      setSaveReadingError("The reading could not be saved.");
    } finally {
      if (generation === saveGenerationRef.current) setSavingReading(false);
    }
  }, [completedReading, savingReading, savedReadingId]);

  const handleRibbonClick = useCallback(() => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    saveReading();
  }, [isLoggedIn, saveReading]);

  const handleLoginSuccess = useCallback(() => {
    setShowLoginModal(false);
    setIsLoggedIn(true);
    router.refresh();
    saveReading();
  }, [router, saveReading]);

  const cardVisuals = useMemo(
    () =>
      completedReading
        ? Object.fromEntries(
            Object.entries(completedReading.positions).map(([pos, card]) => [
              pos,
              { card: card as TarotCardData, reversed: card.reversed },
            ])
          )
        : {},
    [completedReading]
  );

  const handleBirthdateSubmit = useCallback(() => {
    const { dateParts, validation } = parseAndValidateDate(day, month, year);

    if (!validation.isValid || !dateParts) {
      setBirthdateError(validation.error || "Invalid date");
      return;
    }

    setBirthdateError(null);
    dispatch({
      type: 'BIRTHDATE_SUBMIT',
      day: dateParts.day,
      month: dateParts.month,
      year: dateParts.year,
      configDescriptions: positionDescriptions,
    });
  }, [day, month, year, positionDescriptions]);

  // Scroll the deck into view when the spread appears (after shuffle)
  useEffect(() => {
    if (isPickingCards(game) && deckRef.current) {
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

  // Oracle info modal: Escape key + scroll lock
  useEffect(() => {
    if (!showOracleInfo) return;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowOracleInfo(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKey);
    };
  }, [showOracleInfo]);

  return (
    <>
    {/* overflow-clip (not hidden) so the face-up deck's sticky tray can pin to the page scroll */}
    <div className="relative w-full max-w-6xl mx-auto mt-16 overflow-clip rounded-xl border-2 border-[#d4af37]/30 shadow-2xl"
         style={{
           background: 'linear-gradient(135deg, rgba(26,0,51,0.95) 0%, rgba(45,27,78,0.95) 100%)',
         }}>
      {/* Ornate corner decorations */}
      <OrnateFrame />

      {/* Mystical glow effect */}
      <div className="absolute inset-0 opacity-30 pointer-events-none"
           style={{
             background: 'radial-gradient(circle at 50% 50%, rgba(212,175,55,0.15), transparent 70%)'
           }} />

      {/* Content */}
      <div className={`relative z-10 ${isCompact ? 'p-1 sm:p-12' : 'p-6 sm:p-12'}`}>
        <h1 className={`text-4xl sm:text-6xl font-bold mb-2 text-center text-[#d4af37] tracking-wider ${isCompact ? 'hidden sm:block' : ''}`}
            style={{ fontFamily: "'Cinzel', serif", textShadow: '0 0 20px rgba(212,175,55,0.5)' }}>
          {isManual ? 'Manual Reading' : 'Reading Oracle'}
        </h1>

        <p className={`text-center text-[#d4af37]/70 mb-8 text-sm sm:text-base tracking-wide ${isCompact ? 'hidden sm:block' : ''}`}
           style={{ fontFamily: "'Crimson Pro', serif" }}>
          {isManual ? '✦ Lay Out the Cards You Have Drawn ✦' : '✦ Unveil the Mysteries of Your Path ✦'}
        </p>

        {/* Reading style — inline under the title on mobile, top-right of the panel on sm+.
            Not rendered during the shuffle animation or birthdate entry (nothing to style yet). */}
        {game.phase !== 'shuffling' && game.phase !== 'birthdate-input' && (
        <button
          type="button"
          onClick={() => setShowStyleModal(true)}
          className={`${isPickingCards(game) ? 'hidden sm:flex' : 'flex'} mx-auto ${isCompact ? 'mt-2' : '-mt-4'} mb-6 sm:m-0 sm:absolute sm:top-4 sm:right-4 sm:z-20
                      items-center gap-2 px-3 py-2 text-[#d4af37]/60 hover:text-[#d4af37] transition-colors`}
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          <span aria-hidden="true">◈</span>
          <span className="text-xs sm:text-sm tracking-wider">Reading Style</span>
        </button>
        )}

        {/* Pre-game selection screen */}
        {game.phase === 'setup' && (
          <div className="flex flex-col items-center gap-8 mt-8 py-8">
            <label htmlFor="reading-select"
                   className="text-xs sm:text-sm text-[#d4af37]/60 tracking-[0.25em] uppercase"
                   style={{ fontFamily: "'Cinzel', serif" }}>
              Choose Your Reading
            </label>

            <div className="w-full max-w-md flex flex-col items-center">
              <select
                id="reading-select"
                className="w-full border-2 border-[#d4af37]/50 rounded-lg px-6 py-3 bg-[#1a0033]/80 text-[#e6d5b8] text-lg backdrop-blur-sm
                           focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30 transition-all cursor-pointer"
                style={{ fontFamily: "'Crimson Pro', serif" }}
                value={selectedReading.name}
                onChange={(e) => {
                  const reading = spreadOptions.find(r => r.name === e.target.value);
                  if (reading) {
                    setSelectedReading(reading);
                    setUserQuestion("");
                  }
                }}
              >
                {spreadOptions.map((reading) => (
                  <option key={reading.name} value={reading.name} className="bg-[#1a0033]">
                    {reading.name} ({reading.cards} {reading.cards === 1 ? 'Card' : 'Cards'})
                  </option>
                ))}
              </select>
              <p className="text-[#e6d5b8]/40 text-xs text-center mt-2"
                 style={{ fontFamily: "'Crimson Pro', serif" }}>
                {selectedReading.description}
              </p>
            </div>

            {/* Reversals segmented pill — manual mode sets orientation per card in the tray */}
            {!isManual && (
            <div className="w-full max-w-md flex flex-col items-center">
              <div role="group" aria-label="Card orientation" className="flex w-full border-2 border-[#d4af37]/30 rounded-lg overflow-hidden bg-[#0a0015]/40">
                <button
                  type="button"
                  aria-pressed={!allowReversals}
                  onClick={() => setAllowReversals(false)}
                  className={`flex-1 py-3 px-4 text-center text-xs sm:text-sm tracking-[0.15em] uppercase transition-all duration-300
                    ${!allowReversals
                      ? 'bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] font-bold'
                      : 'text-[#e6d5b8]/60 hover:text-[#e6d5b8]/90 hover:bg-[#d4af37]/10'}`}
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  Upright Only
                </button>
                <button
                  type="button"
                  aria-pressed={allowReversals}
                  onClick={() => setAllowReversals(true)}
                  className={`flex-1 py-3 px-4 text-center text-xs sm:text-sm tracking-[0.15em] uppercase transition-all duration-300 border-l border-[#d4af37]/20
                    ${allowReversals
                      ? 'bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] font-bold'
                      : 'text-[#e6d5b8]/60 hover:text-[#e6d5b8]/90 hover:bg-[#d4af37]/10'}`}
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  With Reversals
                </button>
              </div>
              <p className="text-[#e6d5b8]/40 text-xs text-center mt-2"
                 style={{ fontFamily: "'Crimson Pro', serif" }}>
                {allowReversals ? 'Cards may appear reversed' : 'Cards appear upright only'}
              </p>
            </div>
            )}

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
              className="px-10 py-4 bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] rounded-lg
                         shadow-lg hover:shadow-[#d4af37]/50 transition-all duration-300 font-bold text-lg
                         hover:scale-105 active:scale-95 border border-[#d4af37]/50"
              style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.1em' }}
              onClick={startGame}
            >
              ✦ Begin Your Journey ✦
            </button>

            <button
              type="button"
              onClick={() => setShowOracleInfo(true)}
              className="text-[#d4af37]/50 hover:text-[#d4af37]/80 transition-colors text-sm tracking-widest select-none"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              &#9671; About Our Oracle &#9671;
            </button>
          </div>
        )}

        {/* Birthdate Input (for Significators) */}
        {game.phase === 'birthdate-input' && (
          <div className="flex flex-col items-center gap-8 mt-8 py-8 animate-fadeIn">
            <h2
              className="text-2xl sm:text-3xl font-bold text-[#d4af37] tracking-wider"
              style={{ fontFamily: "'Cinzel', serif", textShadow: '0 0 20px rgba(212,175,55,0.4)' }}
            >
              Enter Your Birth Date
            </h2>
            <p
              className="text-[#e6d5b8]/70 text-base sm:text-lg max-w-md text-center"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              Your personal significators are calculated from your birth date, revealing cards that hold special meaning for your life path.
            </p>

            <div className="flex items-center gap-2 sm:gap-3">
              {([
                { label: "Day", placeholder: "DD", maxLength: 2, width: "w-16", value: day, setValue: setDay },
                { label: "Month", placeholder: "MM", maxLength: 2, width: "w-16", value: month, setValue: setMonth },
                { label: "Year", placeholder: "YYYY", maxLength: 4, width: "w-24", value: year, setValue: setYear },
              ] as const).map((field, i) => (
                <React.Fragment key={field.label}>
                  {i > 0 && <span className="text-[#d4af37]/60 text-2xl">/</span>}
                  <div className="flex flex-col items-center">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={field.maxLength}
                      placeholder={field.placeholder}
                      value={field.value}
                      onChange={(e) => {
                        field.setValue(e.target.value.replace(/\D/g, "").slice(0, field.maxLength));
                        setBirthdateError(null);
                      }}
                      className={`border-2 border-[#d4af37]/50 rounded-lg px-3 py-3 bg-[#1a0033]/80 text-[#e6d5b8] text-lg text-center backdrop-blur-sm
                                 focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30 transition-all ${field.width}`}
                      style={{ fontFamily: "'Crimson Pro', serif" }}
                    />
                    <span className="text-xs text-[#d4af37]/50 mt-1" style={{ fontFamily: "'Cinzel', serif" }}>{field.label}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>

            {birthdateError && (
              <p className="text-red-400 text-sm" style={{ fontFamily: "'Crimson Pro', serif" }}>
                {birthdateError}
              </p>
            )}

            <button
              onClick={handleBirthdateSubmit}
              className="px-10 py-4 bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] rounded-lg
                         shadow-lg hover:shadow-[#d4af37]/50 transition-all duration-300 font-bold text-lg
                         hover:scale-105 active:scale-95 border border-[#d4af37]/50"
              style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.1em' }}
            >
              ✦ Generate Significators ✦
            </button>

            <button
              onClick={() => dispatch({ type: 'RESET' })}
              className="text-[#d4af37]/50 hover:text-[#d4af37]/80 transition-colors text-sm tracking-widest"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              &#9671; Go Back &#9671;
            </button>
          </div>
        )}

        {/* Shuffle Animation */}
        {game.phase === 'shuffling' && (
          <ShuffleAnimation onComplete={handleShuffleComplete} />
        )}

        {/* Manual entry — face-up deck, user picks their physical spread */}
        {game.phase === 'manual-select' && (
          <div ref={deckRef} className="animate-fadeIn">
            <FaceUpDeck
              numCards={numCards}
              positions={positionNames}
              selectedCards={selectedCards}
              onAddCard={handleManualAdd}
              onRemoveCard={handleManualRemove}
              onToggleOrientation={handleManualToggle}
              onComplete={handleManualComplete}
              onCancel={handleNewReading}
            />
          </div>
        )}

        {/* Game in progress - deck and card selection */}
        {isSelecting && (
          <div ref={deckRef}>
            {/* Only show deck selection UI when not yet in reading phase */}
            {game.phase !== 'reading' && (
              <>
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
                    allowReversals={allowReversals}
                  />
                </div>
              </>
            )}

            {/* Reading component - shows after card flip animation completes */}
            {game.phase === 'reading' && (
              <div ref={readingRef} className="mt-10 flex justify-center animate-fadeIn">
                <div className="flex flex-col">
                  {isReadingComplete && (
                    <div className="self-end flex items-center gap-2 mb-3">
                      <div className="flex flex-col items-end">
                        {!savedReadingId && (
                          <span
                            className="text-[10px] sm:text-xs text-[#d4af37]/60 text-right"
                            style={{ fontFamily: "'Cinzel', serif" }}
                          >
                            {savingReading ? "Saving..." : "Save reading"}
                          </span>
                        )}
                        {saveReadingError && (
                          <span
                            className="text-[10px] sm:text-xs text-red-400 text-right max-w-[11rem]"
                            style={{ fontFamily: "'Crimson Pro', serif" }}
                          >
                            {saveReadingError}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleRibbonClick}
                        disabled={savingReading || !!savedReadingId}
                        title={savedReadingId ? "Saved to Journal" : undefined}
                        aria-label={savedReadingId ? "Saved to Journal" : "Save this reading"}
                        className={`shrink-0 p-2 rounded-lg border transition-all duration-300
                          ${savedReadingId
                            ? 'border-[#d4af37] bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033]'
                            : 'border-[#d4af37]/40 text-[#d4af37]/70 hover:text-[#d4af37] hover:border-[#d4af37] bg-[#1a0033]/70'}
                          disabled:cursor-default`}
                      >
                        <svg width="18" height="22" viewBox="0 0 18 22" aria-hidden="true">
                          <path
                            d="M2 1h14v20l-7-5-7 5V1z"
                            fill={savedReadingId ? "currentColor" : "none"}
                            stroke="currentColor"
                            strokeWidth="1.5"
                          />
                        </svg>
                      </button>
                    </div>
                  )}

                  <Reading
                    selectedCards={selectedCards}
                    positions={positionNames}
                    question={selectedReading.showQuestion ? userQuestion : undefined}
                    isComplete={isReadingComplete}
                    significatorResult={completedReading?.significatorResult}
                  />
                </div>
              </div>
            )}

            {game.phase === 'reading' && isReadingComplete && (
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

                {savedReadingId && (
                  <button
                    className="px-8 sm:px-10 py-3 sm:py-4 bg-gradient-to-br from-[#8a2be2]/80 to-[#5a1a9e]/80 text-[#e6d5b8] rounded-lg
                               shadow-lg hover:shadow-[#8a2be2]/40 transition-all duration-300 font-bold text-base sm:text-lg
                               hover:scale-105 active:scale-95 border border-[#8a2be2]/40 animate-fadeIn"
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

    </div>

    {showOracleInfo && (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
           role="dialog"
           aria-modal="true"
           aria-labelledby="oracle-info-title">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"
             onClick={() => setShowOracleInfo(false)} />
        <div className="relative max-w-lg w-full px-6 py-8 border border-[#d4af37]/30 rounded-xl bg-[#0a0015]/95 backdrop-blur-md shadow-2xl"
             style={{ fontFamily: "'Crimson Pro', serif" }}>
          <button
            type="button"
            onClick={() => setShowOracleInfo(false)}
            className="absolute top-3 right-4 text-[#d4af37]/50 hover:text-[#d4af37] transition-colors text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
          <h3 id="oracle-info-title"
              className="text-center text-[#d4af37]/70 text-sm tracking-widest mb-6"
              style={{ fontFamily: "'Cinzel', serif" }}>
            &#9670; About Our Oracle &#9670;
          </h3>
          <div className="text-[#e6d5b8]/70 text-sm leading-relaxed space-y-3">
            <p>
              Most digital tarot applications shuffle cards using <em>pseudo-random</em> algorithms
              — mathematical formulas that merely <em>simulate</em> randomness. Every outcome is
              predetermined from the moment the page loads, a closed loop with no room for
              anything beyond the machine.
            </p>
            <p className="mt-6">
              Our Oracle is different. Each shuffle draws upon your device&apos;s <strong>hardware
              entropy</strong> — unpredictable physical phenomena such as thermal noise and quantum
              fluctuations within the silicon itself. These events are genuinely indeterminate;
              no algorithm dictates them, no pattern repeats.
            </p>
            <p className="mt-6">
              The card you draw was not waiting inside a formula. It emerged from the fabric
              of the physical universe at the precise moment your intention met the unknown
              — the same primordial chaos that esoteric traditions have always recognised as the
              wellspring of meaning and revelation.
            </p>
            <p className="text-center text-[#d4af37]/40 text-xs tracking-widest pt-1">
              True randomness. True divination.
            </p>
          </div>
        </div>
      </div>
    )}

    {showStyleModal && (
      <ReadingStyleModal
        settings={interpretationSettings}
        onSettingsChange={setInterpretationSettings}
        cardCount={selectedReading.cards || selectedReading.positions.length}
        onClose={handleCloseStyleModal}
      />
    )}

    {showInterpretModal && completedReading && savedReadingId && (
      <InterpretationModal
        readingId={savedReadingId}
        spreadName={completedReading.readingType}
        question={completedReading.question}
        birthDate={completedReading.birth_date}
        cardVisuals={cardVisuals}
        savedInterpretations={savedInterpretations}
        onClose={handleCloseModal}
        onSaved={handleInterpretationSaved}
        initialSettings={interpretationSettings}
        autoGenerate
      />
    )}

    {showLoginModal && completedReading && (
      <LoginToInterpretModal
        onClose={handleCloseLoginModal}
        onSuccess={handleLoginSuccess}
      />
    )}
    </>
  );
}
