// Decanates organized by month for easier lookup
// Card names match TAROT_DECK exactly (no normalization needed)
export interface DecanateEntry {
  startDay: number;
  endDay: number;
  card: string; // Exact name matching TAROT_DECK
  sign: string;
}

export const decanatesByMonth: Record<number, DecanateEntry[]> = {
  1: [ // January
    { startDay: 1, endDay: 9, card: "Three of Pentacles", sign: "Capricorn" },
    { startDay: 10, endDay: 19, card: "Four of Pentacles", sign: "Capricorn" },
    { startDay: 20, endDay: 29, card: "Five of Swords", sign: "Aquarius" },
    { startDay: 30, endDay: 31, card: "Six of Swords", sign: "Aquarius" },
  ],
  2: [ // February
    { startDay: 1, endDay: 8, card: "Six of Swords", sign: "Aquarius" },
    { startDay: 9, endDay: 18, card: "Seven of Swords", sign: "Aquarius" },
    { startDay: 19, endDay: 29, card: "Eight of Cups", sign: "Pisces" }, // Includes leap year Feb 29
  ],
  3: [ // March
    { startDay: 1, endDay: 10, card: "Nine of Cups", sign: "Pisces" },
    { startDay: 11, endDay: 20, card: "Ten of Cups", sign: "Pisces" },
    { startDay: 21, endDay: 30, card: "Two of Wands", sign: "Aries" },
    { startDay: 31, endDay: 31, card: "Three of Wands", sign: "Aries" },
  ],
  4: [ // April
    { startDay: 1, endDay: 10, card: "Three of Wands", sign: "Aries" },
    { startDay: 11, endDay: 20, card: "Four of Wands", sign: "Aries" },
    { startDay: 21, endDay: 30, card: "Five of Pentacles", sign: "Taurus" },
  ],
  5: [ // May
    { startDay: 1, endDay: 10, card: "Six of Pentacles", sign: "Taurus" },
    { startDay: 11, endDay: 20, card: "Seven of Pentacles", sign: "Taurus" },
    { startDay: 21, endDay: 31, card: "Eight of Swords", sign: "Gemini" },
  ],
  6: [ // June
    { startDay: 1, endDay: 10, card: "Nine of Swords", sign: "Gemini" },
    { startDay: 11, endDay: 20, card: "Ten of Swords", sign: "Gemini" },
    { startDay: 21, endDay: 30, card: "Two of Cups", sign: "Cancer" },
  ],
  7: [ // July
    { startDay: 1, endDay: 1, card: "Two of Cups", sign: "Cancer" },
    { startDay: 2, endDay: 11, card: "Three of Cups", sign: "Cancer" },
    { startDay: 12, endDay: 21, card: "Four of Cups", sign: "Cancer" },
    { startDay: 22, endDay: 31, card: "Five of Wands", sign: "Leo" },
  ],
  8: [ // August
    { startDay: 1, endDay: 1, card: "Five of Wands", sign: "Leo" },
    { startDay: 2, endDay: 11, card: "Six of Wands", sign: "Leo" },
    { startDay: 12, endDay: 22, card: "Seven of Wands", sign: "Leo" },
    { startDay: 23, endDay: 31, card: "Eight of Pentacles", sign: "Virgo" },
  ],
  9: [ // September
    { startDay: 1, endDay: 1, card: "Eight of Pentacles", sign: "Virgo" },
    { startDay: 2, endDay: 11, card: "Nine of Pentacles", sign: "Virgo" },
    { startDay: 12, endDay: 22, card: "Ten of Pentacles", sign: "Virgo" },
    { startDay: 23, endDay: 30, card: "Two of Swords", sign: "Libra" },
  ],
  10: [ // October
    { startDay: 1, endDay: 2, card: "Two of Swords", sign: "Libra" },
    { startDay: 3, endDay: 12, card: "Three of Swords", sign: "Libra" },
    { startDay: 13, endDay: 22, card: "Four of Swords", sign: "Libra" },
    { startDay: 23, endDay: 31, card: "Five of Cups", sign: "Scorpio" },
  ],
  11: [ // November
    { startDay: 1, endDay: 1, card: "Five of Cups", sign: "Scorpio" },
    { startDay: 2, endDay: 12, card: "Six of Cups", sign: "Scorpio" },
    { startDay: 13, endDay: 22, card: "Seven of Cups", sign: "Scorpio" },
    { startDay: 23, endDay: 30, card: "Eight of Wands", sign: "Sagittarius" },
  ],
  12: [ // December
    { startDay: 1, endDay: 2, card: "Eight of Wands", sign: "Sagittarius" },
    { startDay: 3, endDay: 12, card: "Nine of Wands", sign: "Sagittarius" },
    { startDay: 13, endDay: 21, card: "Ten of Wands", sign: "Sagittarius" },
    { startDay: 22, endDay: 30, card: "Two of Pentacles", sign: "Capricorn" },
    { startDay: 31, endDay: 31, card: "Three of Pentacles", sign: "Capricorn" },
  ],
};
