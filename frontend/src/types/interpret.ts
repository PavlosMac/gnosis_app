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
  cards: InterpretCardRequest[];
}

export interface CardInterpretation {
  card_name: string;
  position: string;
  orientation: CardOrientation;
  interpretation: string;
}

export interface InterpretResponse {
  card_interpretations: CardInterpretation[];
  synthesis: string;
  model: string;
  tokens_used: number;
}

export type InterpretResult =
  | { ok: true; data: InterpretResponse }
  | { ok: false; error: string };
