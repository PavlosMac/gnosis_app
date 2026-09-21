import { TarotCardData } from "@/types/models";
import type { CardOrientation, Interpretation } from "@/types/interpret";
import type { SignificatorResult } from "@/lib/significators";

export interface SelectedCard extends TarotCardData {
  idx: number;
  reversed: boolean;
}

export interface ReadingResult {
  readingType: string;
  positions: Record<string, SelectedCard>;
  question?: string;
  positionDescriptions?: Record<string, string>;
  birth_date?: string;
  significatorResult?: SignificatorResult;
}

export interface SavedCard {
  name: string;
  position: string;
  orientation: CardOrientation;
  position_description?: string;
}

export interface ReadingListItem {
  _id: string;
  user_id: string;
  spread_type: string;
  question: string | null;
  cards: SavedCard[];
  created_at: string;
  birth_date?: string;
  tags: string[];
}

export interface ReadingDetail extends ReadingListItem {
  // The reading's one interpretation (generate is idempotent), null before it exists
  interpretation: Interpretation | null;
}

export type UpdateTagsResult =
  | { ok: true; data: ReadingDetail }
  | { ok: false; error: string };

/** One entry in the user's tag vocabulary, as returned on the readings list payload */
export interface TagSummary {
  name: string;
  count: number;
}

export interface PaginatedReadings {
  items: ReadingListItem[];
  total: number;
  page: number;
  page_size: number;
  /** The user's whole tag vocabulary, most-used first — independent of page/filters.
   *  Absent on backends that predate the tag vocabulary; callers must default to []. */
  user_tags?: TagSummary[];
}

/** A single position in a spread, as declared in readings-config.json */
export interface PositionConfig {
  name: string;
  description: string;
}

/** A spread as declared in readings-config.json */
export interface ReadingConfig {
  name: string;
  description?: string;
  /** Cards drawn from the deck. Omitted for birth-date spreads (Significators) */
  cards?: number;
  /** Explicit marker for spreads computed from a birth date — see isBirthdateSpread() */
  birthDate?: boolean;
  /** Omitted for spreads without named positions — see resolvePositions() */
  positions?: PositionConfig[];
  showQuestion?: boolean;
  meta?: {
    field: string;
    placeholder: string;
    button: string;
  };
}
