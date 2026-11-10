"use client";

import { useEffect, useState } from "react";
import SanctumModal from "@/components/SanctumModal";
import TarotCard from "@/components/TarotCard";
import type { MajorArcanaMeaningResponse } from "@/types/auth";
import type { TarotCardData } from "@/types/models";
import { getMajorArcanaMeaning } from "./actions";

const CINZEL = { fontFamily: "'Cinzel', serif" } as const;
const CRIMSON = { fontFamily: "'Crimson Pro', serif" } as const;

export type CardMeaningState =
  | { status: "loading" }
  | { status: "result"; meaning: MajorArcanaMeaningResponse }
  | { status: "error"; message: string };

/** The write-up is the same for every user and every day, so a card fetched once is kept
    for the page's lifetime: reopening it shows the text at once, with no round trip. Only
    successes are kept, so an error is retried on the next open. */
const meaningCache = new Map<number, MajorArcanaMeaningResponse>();

export const clearMeaningCache = () => meaningCache.clear();

const initialState = (idx: number): CardMeaningState => {
  const meaning = meaningCache.get(idx);
  return meaning ? { status: "result", meaning } : { status: "loading" };
};

/** The cached write-up, or one call to the server action. Never rejects. */
export const loadMeaning = async (idx: number): Promise<CardMeaningState> => {
  const cached = meaningCache.get(idx);
  if (cached) return { status: "result", meaning: cached };
  try {
    const result = await getMajorArcanaMeaning(idx);
    if (!result.ok) return { status: "error", message: result.error };
    meaningCache.set(idx, result.data);
    return { status: "result", meaning: result.data };
  } catch {
    return { status: "error", message: "The card's meaning could not be reached." };
  }
};

interface CardMeaningViewProps {
  card: TarotCardData;
  state: CardMeaningState;
}

/** Pure: the card beside its two paragraphs (the day upright, then its shadow), in
    that order and deliberately unlabelled. Stacked on a phone, side by side from `sm:`. */
export const CardMeaningView = ({ card, state }: CardMeaningViewProps) => (
  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8 px-6 py-6">
    <div className="shrink-0">
      <TarotCard card={card} small showMeaning={false} />
    </div>

    <div className="flex-1 min-w-0 w-full">
      {state.status === "loading" && (
        <p role="status" className="text-[#d4af37]/80 tracking-wider py-4" style={CINZEL}>
          The card unfolds...
        </p>
      )}

      {state.status === "error" && (
        <p className="text-red-400 text-base py-4" style={CRIMSON}>
          {state.message}
        </p>
      )}

      {state.status === "result" &&
        [state.meaning.upright, state.meaning.shadow].map((text, i) => (
          <p
            key={i}
            className="text-[#e6d5b8]/90 text-base sm:text-lg leading-relaxed mb-5 last:mb-0"
            style={CRIMSON}
          >
            {text}
          </p>
        ))}
    </div>
  </div>
);

interface CardMeaningModalProps {
  card: TarotCardData;
  /** The personal day number that chose the card (22 for The Fool) */
  personalNumber: number;
  onClose: () => void;
}

/** Opens from the card of the day: fetches the write-up through the server action
    (unless already cached) and shows it inside the shared dialog chrome. */
const CardMeaningModal = ({ card, personalNumber, onClose }: CardMeaningModalProps) => {
  const [state, setState] = useState<CardMeaningState>(() => initialState(card.idx));

  useEffect(() => {
    if (meaningCache.has(card.idx)) return;
    let cancelled = false;
    loadMeaning(card.idx).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [card.idx]);

  return (
    <SanctumModal
      title={card.name}
      subtitle={`Card of the Day · ${personalNumber} · ${card.meaning}`}
      size="lg"
      onClose={onClose}
    >
      <CardMeaningView card={card} state={state} />
    </SanctumModal>
  );
};

export default CardMeaningModal;
