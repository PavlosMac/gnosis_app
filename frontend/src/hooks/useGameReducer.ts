import { useReducer } from "react";
import type { SelectedCard, ReadingResult } from "@/types/reading";

// ── Game phases (discriminated union) ──────────────────────────────────
export type GamePhase =
  | { phase: 'setup' }
  | { phase: 'shuffling' }
  | { phase: 'selecting'; selectedCards: SelectedCard[] }
  | { phase: 'flipping'; selectedCards: SelectedCard[]; reading: ReadingResult }
  | { phase: 'reading'; selectedCards: SelectedCard[]; reading: ReadingResult };

// ── Actions ────────────────────────────────────────────────────────────
export type GameAction =
  | { type: 'START_SHUFFLE' }
  | { type: 'SHUFFLE_COMPLETE' }
  | { type: 'SELECT_CARD'; card: SelectedCard; numCards: number; positions: string[]; readingName: string; question?: string; positionDescriptions?: Record<string, string> }
  | { type: 'FLIP_COMPLETE' }
  | { type: 'RESET' };

// ── Reducer ────────────────────────────────────────────────────────────
const gameReducer = (state: GamePhase, action: GameAction): GamePhase => {
  switch (action.type) {
    case 'START_SHUFFLE':
      return { phase: 'shuffling' };

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
