import { getRoot, type SignificatorResult } from "@/lib/significators";
import { basePosition, SIGNIFICATORS_SPREAD } from "@/lib/significator-positions";
import { FOOL_INDEX, FOOL_NUMEROLOGY_VALUE } from "@/constants";
import type { TarotCardData } from "@/types/models";
import type { ReadingResult, SelectedCard } from "@/types/reading";

// Internal Record keys only — buildReadingPayload sends every one as plain "life number".
const lifeNumberKey = (index: number) => `life number ${index + 1}`;

// Every life number card shares one position name, so each description states why
// that particular card is in the chart — otherwise the LLM has to improvise a distinction.
export const lifeNumberCardNote = (card: TarotCardData, lifeNumber: number): string => {
  // The Fool is unnumbered on the card but counts as 22
  const cardNumber = card.idx === FOOL_INDEX ? FOOL_NUMEROLOGY_VALUE : card.idx;
  const root = getRoot(lifeNumber);
  if (cardNumber === lifeNumber) {
    return `This card, number ${cardNumber}, bears your life number itself.`;
  }
  if (cardNumber === root) {
    return `This card is number ${cardNumber}, the single-digit root your life number reduces to.`;
  }
  return `This card is number ${cardNumber}, which reduces to the same root, ${root}.`;
};

const compose = (base: string | undefined, suffix: string): string =>
  base ? `${base} ${suffix}` : suffix;

const getPositionDescriptions = (
  result: SignificatorResult,
  configDescriptions?: Record<string, string>
): Record<string, string> => {
  const lookup = (key: string) =>
    configDescriptions?.[basePosition(key)];

  const descriptions: Record<string, string> = {
    "day number": compose(
      lookup("day number"),
      `Your day number is ${result.dayNumber.number}.`
    ),
  };

  const lifeSuffix = `Your life number is ${result.lifeNumber.number}.`;
  result.lifeNumber.cards.forEach((card, index) => {
    const positionName = lifeNumberKey(index);
    descriptions[positionName] = compose(
      lookup(positionName),
      `${lifeSuffix} ${lifeNumberCardNote(card, result.lifeNumber.number)}`
    );
  });

  if (result.zodiacSign) {
    descriptions["star sign"] = compose(
      lookup("star sign"),
      `Your sun sign is ${result.zodiacSign.sign}.`
    );
  }

  if (result.decanate) {
    descriptions["decanate"] = compose(
      lookup("decanate"),
      `Your decanate card from ${result.decanate.sign} is ${result.decanate.decanateCard}.`
    );
  }

  if (result.courtRoyal) {
    descriptions["court royal"] = compose(
      lookup("court royal"),
      `Your court royal is ${result.courtRoyal.card.name}, ruling ${result.courtRoyal.rules}.`
    );
  }

  return descriptions;
};

export const convertSignificatorsToReadingResult = (
  result: SignificatorResult,
  birth_date?: string,
  configDescriptions?: Record<string, string>
): ReadingResult => {
  // Significators are never reversed.
  const positions: Record<string, SelectedCard> = {
    "day number": { ...result.dayNumber.card, reversed: false },
  };

  result.lifeNumber.cards.forEach((card, index) => {
    positions[lifeNumberKey(index)] = { ...card, reversed: false };
  });

  if (result.zodiacSign) {
    positions["star sign"] = { ...result.zodiacSign.card, reversed: false };
  }

  if (result.decanate) {
    positions["decanate"] = { ...result.decanate.card, reversed: false };
  }

  if (result.courtRoyal) {
    positions["court royal"] = { ...result.courtRoyal.card, reversed: false };
  }

  return {
    readingType: SIGNIFICATORS_SPREAD,
    positions,
    positionDescriptions: getPositionDescriptions(result, configDescriptions),
    ...(birth_date && { birth_date }),
    significatorResult: result,
  };
};
