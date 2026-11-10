/**
 * Personal year / month / day numbers from a birth date and today's date, each
 * mapped to a major arcana card. Frontend-computed like the significators chart
 * (ADR-011); the backend only stores the birth date.
 *
 * Two reduction rules (ADR-019, amended by ADR-020): the year and the month
 * reduce to a single digit keeping the master numbers 11 and 22; the day, the
 * number that picks the card, is kept whole up to 22 and reduced by digit sum
 * only above that (23 -> 5), so every major arcana card can come up. The day
 * uses `reduceToMajorArcana` from the significators chart. 22 is The Fool in
 * both.
 */
import { FOOL_INDEX, FOOL_NUMEROLOGY_VALUE } from "@/constants";
import type { DateParts } from "@/lib/dateValidation";
import { isValidDate } from "@/lib/dateValidation";
import { reduceToMajorArcana } from "@/lib/significators";
import { getCardByIndex } from "@/services/cardLookup";
import type { TarotCardData } from "@/types/models";

const MASTER_NUMBERS = new Set([11, FOOL_NUMEROLOGY_VALUE]);
/** From this day of the month the personal month looks ahead to the next month */
const MONTH_ROLLOVER_DAY = 21;

export const sumDigits = (n: number): number =>
  String(Math.abs(n))
    .split("")
    .reduce((sum, digit) => sum + Number(digit), 0);

export const reduceKeepingMasters = (n: number): number => {
  while (n > 9 && !MASTER_NUMBERS.has(n)) n = sumDigits(n);
  return n;
};

export const personalYear = (birth: DateParts, today: DateParts): number =>
  reduceKeepingMasters(sumDigits(birth.day) + sumDigits(birth.month) + sumDigits(today.year));

export const personalMonth = (birth: DateParts, today: DateParts): number => {
  if (today.day < MONTH_ROLLOVER_DAY) {
    return reduceKeepingMasters(personalYear(birth, today) + today.month);
  }
  // Looking ahead from December lands in January of the next year, so the
  // personal year moves with it
  const wraps = today.month === 12;
  const year = wraps ? today.year + 1 : today.year;
  const month = wraps ? 1 : today.month + 1;
  return reduceKeepingMasters(personalYear(birth, { ...today, year }) + month);
};

export const personalDay = (birth: DateParts, today: DateParts): number =>
  reduceToMajorArcana(today.day + personalMonth(birth, today));

/** 1..21 are the major arcana by index; 22 is The Fool */
export const cardForPersonalNumber = (n: number): TarotCardData =>
  getCardByIndex(n === FOOL_NUMEROLOGY_VALUE ? FOOL_INDEX : n);

export interface PersonalNumber {
  number: number;
  card: TarotCardData;
}

export interface PersonalNumbers {
  year: PersonalNumber;
  month: PersonalNumber;
  day: PersonalNumber;
}

const parseIsoDate = (iso: string): DateParts | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  return isValidDate(day, month, year) ? { year, month, day } : null;
};

/** All three numbers for an ISO "YYYY-MM-DD" birth date; null when it does not parse */
export const personalNumbers = (
  birthDateIso: string,
  today: DateParts,
): PersonalNumbers | null => {
  const birth = parseIsoDate(birthDateIso);
  if (!birth) return null;
  const withCard = (number: number): PersonalNumber => ({
    number,
    card: cardForPersonalNumber(number),
  });
  return {
    year: withCard(personalYear(birth, today)),
    month: withCard(personalMonth(birth, today)),
    day: withCard(personalDay(birth, today)),
  };
};
