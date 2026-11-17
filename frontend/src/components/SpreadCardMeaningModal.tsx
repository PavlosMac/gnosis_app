"use client";

import { getSpreadCardMeaning } from "@/app/reading/actions";
import {
  CardMeaningBody,
  createMeaningLoader,
  useCardMeaning,
} from "@/components/CardMeaningDialog";
import SanctumModal from "@/components/SanctumModal";
import { displayPositionName } from "@/lib/relationship-spread";
import { findCardByNameSafe } from "@/services/cardLookup";
import type { SpreadCardMeaningResponse } from "@/types/auth";
import type { TarotCardData } from "@/types/models";
import type { SpreadCardSelection } from "@/types/reading";

// The arrow keeps the action looked up at call time, not captured at import
const spreadMeanings = createMeaningLoader<SpreadCardMeaningResponse>((idx) =>
  getSpreadCardMeaning(idx)
);

export const clearSpreadMeaningCache = spreadMeanings.clear;
export const loadSpreadMeaning = spreadMeanings.load;

/** The card's place in the deck, by NAME. A card in a spread cannot be trusted for its
    `idx`: the draw flow overwrites it with the slot in the shuffled grid, and the Tree and
    Relationship layouts with the position index. -1 when the name is not in the deck, which
    the action refuses. */
export const deckIndexForCard = (card: Pick<TarotCardData, "name">): number =>
  findCardByNameSafe(card.name)?.idx ?? -1;

export const spreadMeaningParagraphs = (meaning: SpreadCardMeaningResponse): string[] =>
  meaning.meaning
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

export const spreadDialogTitle = ({ card, reversed }: SpreadCardSelection): string =>
  reversed ? `${card.name} (Reversed)` : card.name;

export const spreadDialogSubtitle = ({
  position,
  positionDescription,
}: SpreadCardSelection): string | undefined =>
  [position && displayPositionName(position), positionDescription]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ") || undefined;

interface SpreadCardMeaningModalProps {
  selection: SpreadCardSelection;
  onClose: () => void;
}

/** Opens from a card in a spread, on the live reading and on a saved one: fetches the
    card's stored meaning (unless already cached) and shows it in the shared dialog chrome.
    The text is the same for an upright and a reversed card; the card is drawn as it fell. */
const SpreadCardMeaningModal = ({ selection, onClose }: SpreadCardMeaningModalProps) => {
  const state = useCardMeaning(spreadMeanings, deckIndexForCard(selection.card));

  return (
    <SanctumModal
      title={spreadDialogTitle(selection)}
      subtitle={spreadDialogSubtitle(selection)}
      size="lg"
      onClose={onClose}
    >
      <CardMeaningBody
        card={{ ...selection.card, reversed: selection.reversed }}
        state={state}
        paragraphs={spreadMeaningParagraphs}
      />
    </SanctumModal>
  );
};

export default SpreadCardMeaningModal;
