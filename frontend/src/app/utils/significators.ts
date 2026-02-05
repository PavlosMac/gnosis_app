import { TarotCardData } from "../models";
import { zodiacSigns } from "./zodiac";
import { decanatesByMonth } from "./decanates";
import {
  MAJOR_ARCANA_THRESHOLD,
  SINGLE_DIGIT_MAX,
  FOOL_INDEX,
  FOOL_ROOT,
} from "../constants";
import {
  getCardByIndex,
  findCardByName,
  getMajorArcana,
} from "../services/cardLookup";

/**
 * Reduce a number to Major Arcana range (22 or less)
 * Uses digit summing until within threshold
 */
export const reduceToMajorArcana = (n: number): number => {
  while (n > MAJOR_ARCANA_THRESHOLD) {
    n = String(n)
      .split("")
      .reduce((sum, digit) => sum + Number(digit), 0);
  }
  return n;
};

/**
 * Get single digit root for numerology
 */
export const getRoot = (n: number): number => {
  while (n > SINGLE_DIGIT_MAX) {
    n = String(n)
      .split("")
      .reduce((sum, digit) => sum + Number(digit), 0);
  }
  return n;
};

/**
 * Get all Major Arcana cards that share the same numerological root
 * Note: The Fool (idx 0) is numerologically treated as 22, which reduces to 4
 */
export const getRelatedMajorArcana = (num: number): TarotCardData[] => {
  const targetRoot = getRoot(num);
  const majorArcana = getMajorArcana();

  return majorArcana.filter((card) => {
    // The Fool (idx 0) numerologically equals 22, which reduces to 4
    const cardRoot = card.idx === FOOL_INDEX ? FOOL_ROOT : getRoot(card.idx);
    return cardRoot === targetRoot;
  });
};

/**
 * Day Number: Day of month reduced to Major Arcana index
 */
export const getDayNumber = (day: number): { number: number; card: TarotCardData } => {
  const reduced = reduceToMajorArcana(day);
  return {
    number: reduced,
    card: getCardByIndex(reduced),
  };
};

/**
 * Astrological Sign: Find zodiac sign card from date
 */
export const getZodiacSign = (
  day: number,
  month: number
): { sign: string; card: TarotCardData } | null => {
  for (const zodiac of zodiacSigns) {
    const { start_date, end_date } = zodiac;

    // Handle signs that cross year boundary (e.g., Capricorn: Dec 22 - Jan 19)
    if (start_date.month > end_date.month) {
      if (
        (month === start_date.month && day >= start_date.day) ||
        (month === end_date.month && day <= end_date.day)
      ) {
        return {
          sign: zodiac.name,
          card: getCardByIndex(zodiac.majorArcanaIndex),
        };
      }
    } else {
      // Normal case: sign within same calendar year
      if (
        (month === start_date.month && day >= start_date.day) ||
        (month === end_date.month && day <= end_date.day) ||
        (month > start_date.month && month < end_date.month)
      ) {
        return {
          sign: zodiac.name,
          card: getCardByIndex(zodiac.majorArcanaIndex),
        };
      }
    }
  }
  return null;
};

/**
 * Life Number: Sum all date digits, reduce, and find related cards
 */
export const getLifeNumber = (
  year: number,
  month: number,
  day: number
): { number: number; cards: TarotCardData[] } => {
  const sum = String(year)
    .split("")
    .concat(String(month).split(""))
    .concat(String(day).split(""))
    .reduce((acc, digit) => acc + Number(digit), 0);

  const reduced = reduceToMajorArcana(sum);
  const relatedCards = getRelatedMajorArcana(reduced);

  return {
    number: reduced,
    cards: relatedCards,
  };
};

/**
 * Decanate: Find decanate card from date using month-first lookup
 * Returns the Minor Arcana card associated with the birth date's decanate
 */
export const getDecanate = (
  day: number,
  month: number
): { sign: string; card: TarotCardData; decanateCard: string } | null => {
  const monthDecanates = decanatesByMonth[month];
  if (!monthDecanates) return null;

  for (const decanate of monthDecanates) {
    if (day >= decanate.startDay && day <= decanate.endDay) {
      // Card names now match TAROT_DECK exactly - no normalization needed
      const card = findCardByName(decanate.card);
      return {
        sign: decanate.sign,
        card,
        decanateCard: decanate.card,
      };
    }
  }

  return null;
};

// Type definitions for results
export interface SignificatorResult {
  dayNumber: { number: number; card: TarotCardData };
  zodiacSign: { sign: string; card: TarotCardData } | null;
  lifeNumber: { number: number; cards: TarotCardData[] };
  decanate: { sign: string; card: TarotCardData; decanateCard: string } | null;
}

/**
 * Calculate all significators for a given birth date
 */
export const calculateSignificators = (
  year: number,
  month: number,
  day: number
): SignificatorResult => {
  return {
    dayNumber: getDayNumber(day),
    zodiacSign: getZodiacSign(day, month),
    lifeNumber: getLifeNumber(year, month, day),
    decanate: getDecanate(day, month),
  };
};
