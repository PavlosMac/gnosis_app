import { TarotCardData } from "@/types/models";
import type { CardOrientation, CardInterpretation } from "@/types/interpret";
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
  card_interpretations: CardInterpretation[];
  synthesis: string;
  model: string;
  tokens_used: number;
}

export type UpdateTagsResult =
  | { ok: true; data: ReadingDetail }
  | { ok: false; error: string };

export interface PaginatedReadings {
  items: ReadingListItem[];
  total: number;
  page: number;
  page_size: number;
}
