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

/** The position's name only: the header is one truncated line, and the description (up to
    ~270 characters on the Tree of Life) is shown whole in the body instead */
export const spreadDialogSubtitle = ({ position }: SpreadCardSelection): string | undefined =>
  (position && displayPositionName(position).trim()) || undefined;

export const spreadDialogDescription = ({
  positionDescription,
}: SpreadCardSelection): string | undefined => positionDescription?.trim() || undefined;

interface SpreadCardMeaningModalProps {
  selection: SpreadCardSelection;
  onClose: () => void;
}

/** Opens from a card in a spread, on the live reading and on a saved one: fetches the
    card's stored meaning (unless already cached) and shows it in the shared dialog chrome.
    The text is the same for an upright and a reversed card; the card is drawn as it fell. */
const SpreadCardMeaningModal = ({ selection, onClose }: SpreadCardMeaningModalProps) => {
  const state = useCardMeaning(spreadMeanings, deckIndexForCard(selection.card));
  const description = spreadDialogDescription(selection);

  return (
    <SanctumModal
      title={spreadDialogTitle(selection)}
      subtitle={spreadDialogSubtitle(selection)}
      size="lg"
      onClose={onClose}
    >
      {description && (
        <p
          className="px-6 pt-6 text-sm sm:text-base italic leading-relaxed text-[#e6d5b8]/70"
          style={{ fontFamily: "'Crimson Pro', serif" }}
        >
          {description}
        </p>
      )}
      <CardMeaningBody
        card={{ ...selection.card, reversed: selection.reversed }}
        state={state}
        paragraphs={spreadMeaningParagraphs}
      />
    </SanctumModal>
  );
};

export default SpreadCardMeaningModal;
