import { TAROT_DECK } from "../utils/cards";
import { TarotCardData } from "../models";
import { MAJOR_ARCANA_MAX_INDEX } from "../constants";

// Custom error for card lookup failures
export class CardNotFoundError extends Error {
  constructor(identifier: string | number) {
    super(`Card not found: ${identifier}`);
    this.name = "CardNotFoundError";
  }
}

// Custom error for invalid index
export class InvalidCardIndexError extends Error {
  constructor(index: number) {
    super(`Invalid card index: ${index}. Must be between 0 and ${TAROT_DECK.length - 1}`);
    this.name = "InvalidCardIndexError";
  }
}

/**
 * Find a card by its exact name
 * @throws CardNotFoundError if card is not found
 */
export const findCardByName = (name: string): TarotCardData => {
  const card = TAROT_DECK.find((c) => c.name === name);
  if (!card) {
    throw new CardNotFoundError(name);
  }
  return card;
};

/**
 * Find a card by its exact name, returns null if not found (safe version)
 */
export const findCardByNameSafe = (name: string): TarotCardData | null => {
  return TAROT_DECK.find((c) => c.name === name) ?? null;
};

/**
 * Get a card by its index
 * @throws InvalidCardIndexError if index is out of bounds
 */
export const getCardByIndex = (index: number): TarotCardData => {
  if (index < 0 || index >= TAROT_DECK.length) {
    throw new InvalidCardIndexError(index);
  }
  return TAROT_DECK[index];
};

/**
 * Get a card by its index, returns null if out of bounds (safe version)
 */
export const getCardByIndexSafe = (index: number): TarotCardData | null => {
  if (index < 0 || index >= TAROT_DECK.length) {
    return null;
  }
  return TAROT_DECK[index];
};

/**
 * Check if an index is a valid Major Arcana index
 */
export const isMajorArcana = (index: number): boolean => {
  return index >= 0 && index <= MAJOR_ARCANA_MAX_INDEX;
};

/**
 * Get all Major Arcana cards
 */
export const getMajorArcana = (): TarotCardData[] => {
  return TAROT_DECK.filter((card) => card.idx <= MAJOR_ARCANA_MAX_INDEX);
};

/**
 * Get all Minor Arcana cards
 */
export const getMinorArcana = (): TarotCardData[] => {
  return TAROT_DECK.filter((card) => card.idx > MAJOR_ARCANA_MAX_INDEX);
};
