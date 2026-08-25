import { interpretationSettingsSchema } from "@/lib/validation/interpret-schemas";
import { LENSES, INTENTS } from "@/types/interpret";
import type {
  InterpretationSettings,
  InterpretationLens,
  InterpretationIntent,
} from "@/types/interpret";

export { LENSES, INTENTS };

export const LENS_LABELS: Record<InterpretationLens, string> = {
  traditional: "Traditional",
  psychological: "Psychological",
  esoteric: "Esoteric",
  alchemical: "Alchemical",
};

export const INTENT_LABELS: Record<InterpretationIntent, string> = {
  reflective: "Reflective",
  predictive: "Predictive",
};

export const DEFAULT_SETTINGS: InterpretationSettings = {
  lens: "traditional",
  intent: "reflective",
  depth: 60,
};

// Word-budget model agreed with the backend (docs/multi-lens-interpretations.md):
// synthesis reserves 30% of the total, cards split the remaining 70%.
const MIN_TOTAL_WORDS = 150;
const MAX_TOTAL_WORDS = 1200;
const SYNTHESIS_SHARE = 0.3;

export const estimatedWordsPerCard = (depth: number, cardCount: number): number => {
  if (cardCount < 1) return 0;
  const total =
    MIN_TOTAL_WORDS + (MAX_TOTAL_WORDS - MIN_TOTAL_WORDS) * (depth / 100);
  return Math.round((total * (1 - SYNTHESIS_SHARE)) / cardCount);
};

export const settingsEqual = (
  a: InterpretationSettings,
  b: InterpretationSettings
): boolean => a.lens === b.lens && a.intent === b.intent && a.depth === b.depth;

const STORAGE_KEY = "interpretation-default-settings";

export const readDefaultSettings = (): InterpretationSettings => {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = interpretationSettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const writeDefaultSettings = (settings: InterpretationSettings): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // best-effort: storage full/blocked means no sticky default, never an error
  }
};
