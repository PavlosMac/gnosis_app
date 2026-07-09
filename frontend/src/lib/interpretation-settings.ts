import type { InterpretationSettings } from "@/types/interpret";

export const DEFAULT_SETTINGS: InterpretationSettings = {
  style: "reflective",
  depth: 60,
  tone: 50,
};

const DEPTH_BANDS: Array<{ max: number; label: string }> = [
  { max: 25, label: "brief" },
  { max: 50, label: "standard" },
  { max: 75, label: "detailed" },
  { max: 100, label: "comprehensive" },
];

const TONE_BANDS: Array<{ max: number; label: string }> = [
  { max: 33, label: "gentle" },
  { max: 66, label: "balanced" },
  { max: 100, label: "direct" },
];

const bandLabel = (bands: Array<{ max: number; label: string }>, value: number): string =>
  (bands.find((band) => value <= band.max) ?? bands[bands.length - 1]).label;

export const depthBandLabel = (depth: number): string => bandLabel(DEPTH_BANDS, depth);

export const toneBandLabel = (tone: number): string => bandLabel(TONE_BANDS, tone);

export interface GenerationInputs {
  settings: InterpretationSettings;
  context: string;
}

export const generationInputsChanged = (
  current: GenerationInputs,
  baseline: GenerationInputs
): boolean =>
  current.settings.style !== baseline.settings.style ||
  current.settings.depth !== baseline.settings.depth ||
  current.settings.tone !== baseline.settings.tone ||
  current.context.trim() !== baseline.context.trim();
