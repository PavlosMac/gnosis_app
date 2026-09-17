import { useReducer } from "react";
import type { SelectedCard, ReadingResult } from "@/types/reading";
import { calculateSignificators } from "@/lib/significators";
import { convertSignificatorsToReadingResult } from "@/lib/significator-conversion";

// ── Game phases (discriminated union) ──────────────────────────────────
export type GamePhase =
  | { phase: 'setup' }
  | { phase: 'birthdate-input'; readingName: string }
  | { phase: 'shuffling' }
  | { phase: 'selecting'; selectedCards: SelectedCard[] }
  | { phase: 'manual-select'; selectedCards: SelectedCard[] }
  | { phase: 'flipping'; selectedCards: SelectedCard[]; reading: ReadingResult }
  | { phase: 'reading'; selectedCards: SelectedCard[]; reading: ReadingResult };

// ── Actions ────────────────────────────────────────────────────────────
export type GameAction =
  | { type: 'START_SHUFFLE' }
  | { type: 'START_BIRTHDATE_INPUT'; readingName: string }
  | { type: 'BIRTHDATE_SUBMIT'; day: number; month: number; year: number; configDescriptions?: Record<string, string> }
  | { type: 'SHUFFLE_COMPLETE' }
  | { type: 'SELECT_CARD'; card: SelectedCard; numCards: number; positions: string[]; readingName: string; question?: string; positionDescriptions?: Record<string, string> }
  | { type: 'FLIP_COMPLETE' }
  | { type: 'START_MANUAL_ENTRY' }
  | { type: 'MANUAL_ADD_CARD'; card: SelectedCard; numCards: number }
  | { type: 'MANUAL_TOGGLE_ORIENTATION'; cardIdx: number }
  | { type: 'MANUAL_REMOVE_CARD'; cardIdx: number }
  | { type: 'MANUAL_COMPLETE'; positions: string[]; readingName: string; question?: string; positionDescriptions?: Record<string, string> }
  | { type: 'RESET' };

// ── Helpers ────────────────────────────────────────────────────────────
const buildReading = (
  cards: SelectedCard[],
  positionNames: string[],
  readingName: string,
  question?: string,
  positionDescriptions?: Record<string, string>,
): ReadingResult => {
  const positions = positionNames.reduce((acc, position, idx) => {
    if (cards[idx]) acc[position] = cards[idx];
    return acc;
  }, {} as Record<string, SelectedCard>);
  return {
    readingType: readingName,
    positions,
    ...(question && { question }),
    ...(positionDescriptions && { positionDescriptions }),
  };
};

// ── Reducer ────────────────────────────────────────────────────────────
export const gameReducer = (state: GamePhase, action: GameAction): GamePhase => {
  switch (action.type) {
    case 'START_SHUFFLE':
      return { phase: 'shuffling' };

    case 'START_BIRTHDATE_INPUT':
      return { phase: 'birthdate-input', readingName: action.readingName };

    case 'BIRTHDATE_SUBMIT': {
      const significators = calculateSignificators(action.year, action.month, action.day);
      const birth_date = `${action.year}-${String(action.month).padStart(2, '0')}-${String(action.day).padStart(2, '0')}`;
      const reading = convertSignificatorsToReadingResult(significators, birth_date, action.configDescriptions);
      const selectedCards = Object.values(reading.positions);
      return { phase: 'reading', selectedCards, reading };
    }

    case 'SHUFFLE_COMPLETE':
      return { phase: 'selecting', selectedCards: [] };

    case 'SELECT_CARD': {
      if (state.phase !== 'selecting') return state;
      const next = [...state.selectedCards, action.card];
      if (next.length < action.numCards) {
        return { phase: 'selecting', selectedCards: next };
      }
      // All cards selected — build reading and transition to flipping
      const reading = buildReading(next, action.positions, action.readingName, action.question, action.positionDescriptions);
      return { phase: 'flipping', selectedCards: next, reading };
    }

    // ── Manual (face-up) entry ─────────────────────────────────────────
    case 'START_MANUAL_ENTRY':
      if (state.phase !== 'setup') return state;
      return { phase: 'manual-select', selectedCards: [] };

    case 'MANUAL_ADD_CARD': {
      if (state.phase !== 'manual-select') return state;
      if (state.selectedCards.length >= action.numCards) return state;
      if (state.selectedCards.some((c) => c.idx === action.card.idx)) return state;
      return { phase: 'manual-select', selectedCards: [...state.selectedCards, action.card] };
    }

    case 'MANUAL_TOGGLE_ORIENTATION':
      if (state.phase !== 'manual-select') return state;
      return {
        phase: 'manual-select',
        selectedCards: state.selectedCards.map((c) =>
          c.idx === action.cardIdx ? { ...c, reversed: !c.reversed } : c
        ),
      };

    case 'MANUAL_REMOVE_CARD':
      if (state.phase !== 'manual-select') return state;
      return {
        phase: 'manual-select',
        selectedCards: state.selectedCards.filter((c) => c.idx !== action.cardIdx),
      };

    case 'MANUAL_COMPLETE': {
      if (state.phase !== 'manual-select') return state;
      if (state.selectedCards.length !== action.positions.length) return state;
      // Cards are already face-up — skip the flipping phase (see BIRTHDATE_SUBMIT)
      const reading = buildReading(state.selectedCards, action.positions, action.readingName, action.question, action.positionDescriptions);
      return { phase: 'reading', selectedCards: state.selectedCards, reading };
    }

    case 'FLIP_COMPLETE':
      if (state.phase !== 'flipping') return state;
      return { phase: 'reading', selectedCards: state.selectedCards, reading: state.reading };

    case 'RESET':
      return { phase: 'setup' };

    default:
      return state;
  }
};

// ── Hook ───────────────────────────────────────────────────────────────
export const useGameReducer = () => useReducer(gameReducer, { phase: 'setup' } as GamePhase);

// ── Accessors ──────────────────────────────────────────────────────────
export const getSelectedCards = (game: GamePhase): SelectedCard[] => {
  if ('selectedCards' in game) return game.selectedCards;
  return [];
};

export const getReading = (game: GamePhase): ReadingResult | null => {
  if ('reading' in game) return game.reading;
  return null;
};

// ── Phase predicates ───────────────────────────────────────────────────
/** Cards have been dealt from the shuffled deck (selecting → flipping → reading) */
export const isPostDeal = (game: GamePhase): boolean =>
  game.phase === 'selecting' || game.phase === 'flipping' || game.phase === 'reading';

/** The user is still picking cards from a deck (shuffled or face-up) */
export const isPickingCards = (game: GamePhase): boolean =>
  game.phase === 'selecting' || game.phase === 'manual-select';

/** A deck or reading occupies the panel — compact chrome on mobile */
export const hasDeckOnScreen = (game: GamePhase): boolean =>
  isPostDeal(game) || game.phase === 'manual-select';
