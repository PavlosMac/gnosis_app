/**
 * Personal year / month / day numbers from a birth date and today's date, each
 * mapped to a major arcana card. Frontend-computed like the significators chart
 * (ADR-011); the backend only stores the birth date.
 *
 * Not shared with `lib/significators.ts`: its `reduceToMajorArcana` lets 22
 * through to `TAROT_DECK[22]` (the Ace of Pentacles, see bugs.md). Here the
 * master numbers 11 and 22 are kept and 22 is The Fool.
 */
import type { DateParts } from "@/lib/dateValidation";
import { isValidDate } from "@/lib/dateValidation";
import { getCardByIndex } from "@/services/cardLookup";
import type { TarotCardData } from "@/types/models";

const MASTER_NUMBERS = new Set([11, 22]);
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
  reduceKeepingMasters(today.day + personalMonth(birth, today));

/** 1..21 are the major arcana by index; 22 (a master number) is The Fool */
export const cardForPersonalNumber = (n: number): TarotCardData =>
  getCardByIndex(n === 22 ? 0 : n);

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
