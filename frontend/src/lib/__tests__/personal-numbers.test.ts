import { describe, expect, it } from "vitest";
import {
  cardForPersonalNumber,
  personalDay,
  personalMonth,
  personalNumbers,
  personalYear,
  reduceKeepingMasters,
  sumDigits,
} from "@/lib/personal-numbers";

const BIRTH = { year: 1990, month: 5, day: 1 };

describe("sumDigits", () => {
  it("adds the digits", () => {
    expect(sumDigits(0)).toBe(0);
    expect(sumDigits(7)).toBe(7);
    expect(sumDigits(29)).toBe(11);
    expect(sumDigits(2026)).toBe(10);
  });
});

describe("reduceKeepingMasters", () => {
  it("reduces to a single digit", () => {
    expect(reduceKeepingMasters(10)).toBe(1);
    expect(reduceKeepingMasters(19)).toBe(1);
    expect(reduceKeepingMasters(12)).toBe(3);
  });

  it("keeps the master numbers 11 and 22", () => {
    expect(reduceKeepingMasters(11)).toBe(11);
    expect(reduceKeepingMasters(22)).toBe(22);
    expect(reduceKeepingMasters(29)).toBe(11);
    expect(reduceKeepingMasters(38)).toBe(11);
  });
});

describe("cardForPersonalNumber", () => {
  it("maps 1..21 to the major arcana by index", () => {
    expect(cardForPersonalNumber(1).name).toBe("The Magician");
    expect(cardForPersonalNumber(11).name).toBe("Justice");
    expect(cardForPersonalNumber(21).name).toBe("The World");
  });

  it("maps 22 to The Fool, never to the first minor card", () => {
    expect(cardForPersonalNumber(22).name).toBe("The Fool");
  });
});

describe("personalYear", () => {
  it("is the reduced sum of the birth day, birth month and the current year's digits", () => {
    // sum(1) + sum(5) + sum(2026) = 1 + 5 + 10 = 16 -> 7
    expect(personalYear(BIRTH, { year: 2026, month: 11, day: 3 })).toBe(7);
  });
});

describe("personalMonth", () => {
  it("uses the current month before the 21st", () => {
    // year 7 + month 11 = 18 -> 9
    expect(personalMonth(BIRTH, { year: 2026, month: 11, day: 20 })).toBe(9);
  });

  it("rolls forward to the next month from the 21st", () => {
    // year 7 + month 12 = 19 -> 1
    expect(personalMonth(BIRTH, { year: 2026, month: 11, day: 21 })).toBe(1);
  });

  it("wraps December to January from the 21st", () => {
    // looking ahead into January moves to the 2027 personal year:
    // sum(1) + sum(5) + sum(2027) = 1 + 5 + 11 = 17 -> 8; 8 + month 1 = 9
    expect(personalMonth(BIRTH, { year: 2026, month: 12, day: 21 })).toBe(9);
    // year 7 + month 12 = 19 -> 1
    expect(personalMonth(BIRTH, { year: 2026, month: 12, day: 20 })).toBe(1);
  });
});

describe("personalDay", () => {
  it("is the reduced sum of the day of the month and the personal month", () => {
    // day 3 + month 9 = 12 -> 3
    expect(personalDay(BIRTH, { year: 2026, month: 11, day: 3 })).toBe(3);
  });
});

describe("personalNumbers", () => {
  it("returns the three numbers with their cards for an ISO birth date", () => {
    const result = personalNumbers("1990-05-01", { year: 2026, month: 11, day: 3 });
    expect(result).not.toBeNull();
    expect(result!.year).toMatchObject({ number: 7, card: { name: "The Chariot" } });
    expect(result!.month).toMatchObject({ number: 9, card: { name: "The Hermit" } });
    expect(result!.day).toMatchObject({ number: 3, card: { name: "The Empress" } });
  });

  it("is null for a blank or unparsable date", () => {
    const today = { year: 2026, month: 11, day: 3 };
    expect(personalNumbers("", today)).toBeNull();
    expect(personalNumbers("garbage", today)).toBeNull();
    expect(personalNumbers("1990-13-01", today)).toBeNull();
    expect(personalNumbers("1990-02-30", today)).toBeNull();
  });
});
