import type { PositionConfig, ReadingConfig } from "@/types/reading";

/**
 * Positions for a spread. Spreads without named positions get generated
 * "Card 1..N" names so cards can still be keyed, saved and interpreted.
 */
export const resolvePositions = (reading: ReadingConfig): PositionConfig[] =>
  reading.positions?.length
    ? reading.positions
    : Array.from({ length: reading.cards ?? 0 }, (_, i) => ({
        name: `Card ${i + 1}`,
        description: "",
      }));

/** Spreads computed from a birth date (Significators) are flagged `birthDate: true`, never inferred. */
export const isBirthdateSpread = (reading: ReadingConfig): boolean =>
  reading.birthDate === true;
