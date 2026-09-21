// Golden Dawn (Book T) court royals. Each Knight, Queen and King rules three
// consecutive decans: the last decan of one sign plus the first two of the next
// (20° of a sign to 20° of the next). Pages rule no decans, so they never appear.
// The King is the Golden Dawn Prince (Air), the Knight keeps Fire — matching
// backend/src/lib/cards/court_royals.json.
// Pip names match TAROT_DECK / decanates.ts exactly.
export interface CourtRoyalEntry {
  royal: string;
  fromSign: string;
  toSign: string;
  pips: [string, string, string];
}

export const COURT_ROYALS: CourtRoyalEntry[] = [
  { royal: "Queen of Wands", fromSign: "Pisces", toSign: "Aries", pips: ["Ten of Cups", "Two of Wands", "Three of Wands"] },
  { royal: "King of Pentacles", fromSign: "Aries", toSign: "Taurus", pips: ["Four of Wands", "Five of Pentacles", "Six of Pentacles"] },
  { royal: "Knight of Swords", fromSign: "Taurus", toSign: "Gemini", pips: ["Seven of Pentacles", "Eight of Swords", "Nine of Swords"] },
  { royal: "Queen of Cups", fromSign: "Gemini", toSign: "Cancer", pips: ["Ten of Swords", "Two of Cups", "Three of Cups"] },
  { royal: "King of Wands", fromSign: "Cancer", toSign: "Leo", pips: ["Four of Cups", "Five of Wands", "Six of Wands"] },
  { royal: "Knight of Pentacles", fromSign: "Leo", toSign: "Virgo", pips: ["Seven of Wands", "Eight of Pentacles", "Nine of Pentacles"] },
  { royal: "Queen of Swords", fromSign: "Virgo", toSign: "Libra", pips: ["Ten of Pentacles", "Two of Swords", "Three of Swords"] },
  { royal: "King of Cups", fromSign: "Libra", toSign: "Scorpio", pips: ["Four of Swords", "Five of Cups", "Six of Cups"] },
  { royal: "Knight of Wands", fromSign: "Scorpio", toSign: "Sagittarius", pips: ["Seven of Cups", "Eight of Wands", "Nine of Wands"] },
  { royal: "Queen of Pentacles", fromSign: "Sagittarius", toSign: "Capricorn", pips: ["Ten of Wands", "Two of Pentacles", "Three of Pentacles"] },
  { royal: "King of Swords", fromSign: "Capricorn", toSign: "Aquarius", pips: ["Four of Pentacles", "Five of Swords", "Six of Swords"] },
  { royal: "Knight of Cups", fromSign: "Aquarius", toSign: "Pisces", pips: ["Seven of Swords", "Eight of Cups", "Nine of Cups"] },
];

const ROYAL_BY_PIP: Record<string, CourtRoyalEntry> = Object.fromEntries(
  COURT_ROYALS.flatMap((entry) => entry.pips.map((pip) => [pip, entry]))
);

/** The court royal that rules a decanate pip, or null if the pip rules none. */
export const getCourtRoyalEntry = (pipName: string): CourtRoyalEntry | null =>
  ROYAL_BY_PIP[pipName] ?? null;

export const describeRoyalSpan = (entry: CourtRoyalEntry): string =>
  `${entry.fromSign} 20° to ${entry.toSign} 20°`;
