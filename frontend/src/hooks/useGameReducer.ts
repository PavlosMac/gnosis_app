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
  | { type: 'RESET' };

// ── Reducer ────────────────────────────────────────────────────────────
const gameReducer = (state: GamePhase, action: GameAction): GamePhase => {
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
      const positions = action.positions.reduce((acc, position, idx) => {
        if (next[idx]) acc[position] = next[idx];
        return acc;
      }, {} as Record<string, SelectedCard>);
      const reading: ReadingResult = {
        readingType: action.readingName,
        positions,
        ...(action.question && { question: action.question }),
        ...(action.positionDescriptions && { positionDescriptions: action.positionDescriptions }),
      };
      return { phase: 'flipping', selectedCards: next, reading };
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
