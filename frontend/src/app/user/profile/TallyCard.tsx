"use client";

import { useCallback, useEffect, useState } from "react";
import TarotCard from "@/components/TarotCard";
import type { DateParts } from "@/lib/dateValidation";
import { personalNumbers, type PersonalNumber } from "@/lib/personal-numbers";
import CardMeaningModal from "./CardMeaningModal";

const CINZEL = { fontFamily: "'Cinzel', serif" } as const;

interface TallyCardViewProps {
  /** ISO "YYYY-MM-DD"; null for accounts that predate the field */
  birthDate: string | null;
  /** The user's local date; null until the component has mounted */
  today: DateParts | null;
  /** Called with the day card when it is clicked */
  onOpen?: (day: PersonalNumber) => void;
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

/** Pure: renders either the empty slot or the personal day card as a button that
    opens its meaning. The server render and the first client render both get
    `today = null`, so the markup matches on hydration whatever the server's timezone. */
export const TallyCardView = ({ birthDate, today, onOpen }: TallyCardViewProps) => {
  const numbers = birthDate && today ? personalNumbers(birthDate, today) : null;
  if (!numbers) return <EmptySlot />;

  // `numbers.month` and `numbers.year` are computed here too and deliberately
  // not shown yet; showing them later is a render change only.
  const { day } = numbers;

  return (
    <div data-testid="tally-card" className="flex flex-col items-center gap-3">
      <p className="text-[#d4af37]/60 text-xs tracking-[0.2em] uppercase" style={CINZEL}>
        Card of the Day &middot; {day.number}
      </p>
      <button
        type="button"
        onClick={() => onOpen?.(day)}
        aria-haspopup="dialog"
        aria-label={`About ${day.card.name}`}
        className="cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]/60"
      >
        <TarotCard card={day.card} showMeaning={false} />
      </button>
      <p className="text-[#e6d5b8]/40 text-[11px] tracking-[0.15em] uppercase" style={CINZEL}>
        Tap the card to read it
      </p>
    </div>
  );
};

interface TallyCardProps {
  birthDate: string | null;
}

/** Owns "today": read from the browser clock after mount, never during render,
    so the card follows the user's local date and nothing depends on the server's.
    Also owns the open meaning dialog. */
const TallyCard = ({ birthDate }: TallyCardProps) => {
  const [today, setToday] = useState<DateParts | null>(null);
  const [open, setOpen] = useState<PersonalNumber | null>(null);
  const close = useCallback(() => setOpen(null), []);

  useEffect(() => {
    const now = new Date();
    setToday({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
  }, []);

  return (
    <>
      <TallyCardView birthDate={birthDate} today={today} onOpen={setOpen} />
      {open && (
        <CardMeaningModal card={open.card} personalNumber={open.number} onClose={close} />
      )}
    </>
  );
};

export default TallyCard;
