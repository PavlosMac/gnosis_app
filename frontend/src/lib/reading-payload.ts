import type { ReadingResult } from "@/types/reading";
import type { InterpretRequest } from "@/types/interpret";
import { basePosition, SIGNIFICATORS_SPREAD } from "@/lib/significator-positions";

const MIN_QUESTION_LENGTH = 5;

export const buildReadingPayload = (reading: ReadingResult): InterpretRequest => {
  const isSignificatorChart = reading.readingType === SIGNIFICATORS_SPREAD;
  const cards = Object.entries(reading.positions).map(([position, card]) => ({
    name: card.name,
    // Life numbers are keyed "life number 1..N" internally; the wire carries no numbers
    position: isSignificatorChart ? basePosition(position) : position,
    orientation: card.reversed ? ("reversed" as const) : ("upright" as const),
    ...(reading.positionDescriptions?.[position] && {
      position_description: reading.positionDescriptions[position],
    }),
  }));

  return {
    spread_name: reading.readingType,
    ...(reading.question && reading.question.trim().length >= MIN_QUESTION_LENGTH && {
      question: reading.question,
    }),
    ...(reading.birth_date && { birth_date: reading.birth_date }),
    cards,
  };
};
