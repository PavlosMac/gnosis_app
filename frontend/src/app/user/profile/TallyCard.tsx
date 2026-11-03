"use client";

import { useEffect, useState } from "react";
import TarotCard from "@/components/TarotCard";
import type { DateParts } from "@/lib/dateValidation";
import { personalNumbers } from "@/lib/personal-numbers";

interface TallyCardViewProps {
  /** ISO "YYYY-MM-DD"; null for accounts that predate the field */
  birthDate: string | null;
  /** The user's local date; null until the component has mounted */
  today: DateParts | null;
}

/** The card-proportioned frame the chalice left behind; kept while there is
    nothing to show so the two-panel layout never shifts */
const EmptySlot = () => (
  <div
    aria-hidden="true"
    data-testid="tally-card-slot"
    className="aspect-[2/3] w-full max-w-[200px] rounded-xl border border-[#d4af37]/10"
  />
);

/** Pure: renders either the empty slot or the personal day card. The server
    render and the first client render both get `today = null`, so the markup
    matches on hydration whatever the server's timezone. */
export const TallyCardView = ({ birthDate, today }: TallyCardViewProps) => {
  const numbers = birthDate && today ? personalNumbers(birthDate, today) : null;
  if (!numbers) return <EmptySlot />;

  // `numbers.month` and `numbers.year` are computed here too and deliberately
  // not shown yet; showing them later is a render change only.
  const { day } = numbers;

  return (
    <div data-testid="tally-card" className="flex flex-col items-center gap-3">
      <p
        className="text-[#d4af37]/60 text-xs tracking-[0.2em] uppercase"
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        Card of the Day &middot; {day.number}
      </p>
      <TarotCard card={day.card} showMeaning={false} />
    </div>
  );
};

interface TallyCardProps {
  birthDate: string | null;
}

/** Owns "today": read from the browser clock after mount, never during render,
    so the card follows the user's local date and nothing depends on the server's. */
const TallyCard = ({ birthDate }: TallyCardProps) => {
  const [today, setToday] = useState<DateParts | null>(null);

  useEffect(() => {
    const now = new Date();
    setToday({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
  }, []);

  return <TallyCardView birthDate={birthDate} today={today} />;
};

export default TallyCard;
