import type { SignificatorResult } from "@/lib/significators";
import type { ReadingResult, SelectedCard } from "@/types/reading";

const LIFE_NUMBER_INDEX_RE = / \d+$/;

const compose = (base: string | undefined, suffix: string): string =>
  base ? `${base} ${suffix}` : suffix;

const getPositionDescriptions = (
  result: SignificatorResult,
  configDescriptions?: Record<string, string>
): Record<string, string> => {
  const lookup = (key: string) =>
    configDescriptions?.[key.replace(LIFE_NUMBER_INDEX_RE, "")];

  const descriptions: Record<string, string> = {
    "day number": compose(
      lookup("day number"),
      `Your day number is ${result.dayNumber.number}.`
    ),
  };

  const lifeSuffix = `Your life number is ${result.lifeNumber.number}.`;
  result.lifeNumber.cards.forEach((_, index) => {
    const positionName =
      result.lifeNumber.cards.length === 1
        ? "life number"
        : `life number ${index + 1}`;
    descriptions[positionName] = compose(lookup(positionName), lifeSuffix);
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
    const positionName =
      result.lifeNumber.cards.length === 1
        ? "life number"
        : `life number ${index + 1}`;
    positions[positionName] = { ...card, reversed: false };
  });

  if (result.zodiacSign) {
    positions["star sign"] = { ...result.zodiacSign.card, reversed: false };
  }

  if (result.decanate) {
    positions["decanate"] = { ...result.decanate.card, reversed: false };
  }

  return {
    readingType: "Significators",
    positions,
    positionDescriptions: getPositionDescriptions(result, configDescriptions),
    ...(birth_date && { birth_date }),
    significatorResult: result,
  };
};
