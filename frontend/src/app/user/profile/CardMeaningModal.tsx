"use client";

import {
  CardMeaningBody,
  createMeaningLoader,
  useCardMeaning,
  type MeaningState,
} from "@/components/CardMeaningDialog";
import SanctumModal from "@/components/SanctumModal";
import type { MajorArcanaMeaningResponse } from "@/types/auth";
import type { TarotCardData } from "@/types/models";
import { getMajorArcanaMeaning } from "./actions";

export type CardMeaningState = MeaningState<MajorArcanaMeaningResponse>;

// The arrow keeps the action looked up at call time, not captured at import
const dayMeanings = createMeaningLoader<MajorArcanaMeaningResponse>((idx) =>
  getMajorArcanaMeaning(idx)
);

export const clearMeaningCache = dayMeanings.clear;

/** The cached write-up, or one call to the server action. Never rejects. */
export const loadMeaning = dayMeanings.load;

const dayParagraphs = (meaning: MajorArcanaMeaningResponse) => [meaning.upright, meaning.shadow];

interface CardMeaningViewProps {
  card: TarotCardData;
  state: CardMeaningState;
}

/** Pure: the card beside its two paragraphs (the day upright, then its shadow), in
    that order and deliberately unlabelled. */
export const CardMeaningView = ({ card, state }: CardMeaningViewProps) => (
  <CardMeaningBody card={card} state={state} paragraphs={dayParagraphs} />
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
  const state = useCardMeaning(dayMeanings, card.idx);

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
