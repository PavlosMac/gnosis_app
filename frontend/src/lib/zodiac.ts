interface ZodiacSign {
  name: string;
  start_date: { day: number; month: number };
  end_date: { day: number; month: number };
  majorArcanaIndex: number;
}

export const zodiacSigns: ZodiacSign[] = [
  {
    name: "Aries",
    majorArcanaIndex: 4,
    start_date: { day: 21, month: 3 },
    end_date: { day: 20, month: 4 }
  },
  {
    name: "Taurus",
    majorArcanaIndex: 5,
    start_date: { day: 21, month: 4 },
    end_date: { day: 20, month: 5 }
  },
  {
    name: "Gemini",
    majorArcanaIndex: 6,
    start_date: { day: 21, month: 5 },
    end_date: { day: 20, month: 6 }
  },
  {
    name: "Cancer",
    majorArcanaIndex: 7,
    start_date: { day: 21, month: 6 },
    end_date: { day: 21, month: 7 }
  },
  {
    name: "Leo",
    majorArcanaIndex: 8,
    start_date: { day: 22, month: 7 },
    end_date: { day: 22, month: 8 }
  },
  {
    name: "Virgo",
    majorArcanaIndex: 9,
    start_date: { day: 23, month: 8 },
    end_date: { day: 22, month: 9 }
  },
  {
    name: "Libra",
    majorArcanaIndex: 11,
    start_date: { day: 23, month: 9 },
    end_date: { day: 22, month: 10 }
  },
  {
    name: "Scorpio",
    majorArcanaIndex: 13,
    start_date: { day: 23, month: 10 },
    end_date: { day: 22, month: 11 }
  },
  {
    name: "Sagittarius",
    majorArcanaIndex: 14,
    start_date: { day: 23, month: 11 },
    end_date: { day: 21, month: 12 }
  },
  {
    name: "Capricorn",
    majorArcanaIndex: 15,
    start_date: { day: 22, month: 12 },
    end_date: { day: 19, month: 1 }
  },
  {
    name: "Aquarius",
    majorArcanaIndex: 17,
    start_date: { day: 20, month: 1 },
    end_date: { day: 18, month: 2 }
  },
  {
    name: "Pisces",
    majorArcanaIndex: 18,
    start_date: { day: 19, month: 2 },
    end_date: { day: 20, month: 3 }
  }
];
