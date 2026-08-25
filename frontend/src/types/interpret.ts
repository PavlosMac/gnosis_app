export type CardOrientation = "upright" | "reversed";

export interface InterpretCardRequest {
  name: string;
  position: string;
  orientation: CardOrientation;
  position_description?: string;
}

export interface InterpretRequest {
  spread_name: string;
  question?: string;
  birth_date?: string;
  cards: InterpretCardRequest[];
}

export interface CardInterpretation {
  card_name: string;
  position: string;
  orientation: CardOrientation;
  interpretation: string;
}

export type InterpretationLens =
  | "traditional"
  | "psychological"
  | "esoteric"
  | "alchemical";

export type InterpretationIntent = "reflective" | "predictive";

export interface InterpretationSettings {
  lens: InterpretationLens;
  intent: InterpretationIntent;
  depth: number; // 0–100 percentage; length budget scaled by card count
}

export interface Interpretation {
  card_interpretations: CardInterpretation[];
  synthesis: string;
  model: string;
  tokens_used: number;
  settings: InterpretationSettings;
  created_at?: string; // absent on an unsaved generate result, set once saved
  updated_at?: string;
}

export type CreateReadingResult =
  | { ok: true; readingId: string }
  | { ok: false; error: string };

export type GenerateInterpretationResult =
  | { ok: true; data: Interpretation }
  | { ok: false; error: string };

export type SaveInterpretationResult =
  | { ok: true; interpretations: Interpretation[] }
  | { ok: false; error: string };
