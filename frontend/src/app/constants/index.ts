// Tarot Constants - Single source of truth for magic numbers

// Major Arcana
export const MAJOR_ARCANA_COUNT = 22;
export const MAJOR_ARCANA_MAX_INDEX = 21;

// The Fool is card 0 but numerologically treated as 22
export const FOOL_INDEX = 0;
export const FOOL_NUMEROLOGY_VALUE = 22;
export const FOOL_ROOT = 4; // 2 + 2 = 4

// Numerology thresholds
export const SINGLE_DIGIT_MAX = 9;
export const MAJOR_ARCANA_THRESHOLD = 22;

// Suit name mappings (for data consistency)
export const SUIT_ALIASES: Record<string, string> = {
  Disks: "Pentacles",
  Coins: "Pentacles",
};

// Number to word mappings for card names
export const NUMBER_TO_WORD: Record<number, string> = {
  1: "Ace",
  2: "Two",
  3: "Three",
  4: "Four",
  5: "Five",
  6: "Six",
  7: "Seven",
  8: "Eight",
  9: "Nine",
  10: "Ten",
};

// Reverse mapping for lookups
export const WORD_TO_NUMBER: Record<string, number> = {
  Ace: 1,
  Two: 2,
  Three: 3,
  Four: 4,
  Five: 5,
  Six: 6,
  Seven: 7,
  Eight: 8,
  Nine: 9,
  Ten: 10,
};
