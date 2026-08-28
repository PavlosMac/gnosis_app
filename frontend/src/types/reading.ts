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
  interpretations: Interpretation[]; // 0–4, at most one per lens
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

/** A single position in a spread, as declared in readings-config.json */
export interface PositionConfig {
  name: string;
  description: string;
}

/** A spread as declared in readings-config.json */
export interface ReadingConfig {
  name: string;
  description?: string;
  cards: number;
  /** Omitted for spreads without named positions — see resolvePositions() */
  positions?: PositionConfig[];
  showQuestion?: boolean;
  meta?: {
    field: string;
    placeholder: string;
    button: string;
  };
}
