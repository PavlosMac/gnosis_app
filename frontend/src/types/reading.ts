import { TarotCardData } from "@/types/models";

export interface SelectedCard extends TarotCardData {
  idx: number;
  reversed: boolean;
}

export interface ReadingResult {
  readingType: string;
  positions: Record<string, SelectedCard>;
  question?: string;
}
