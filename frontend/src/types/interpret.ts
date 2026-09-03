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

// Per-interpretation usage ledger — the answer to "why did my balance drop".
// model here is the resolved provider id from the response, not the configured alias.
export interface InterpretationUsage {
  prompt_tokens: number;
  completion_tokens: number;
  reasoning_tokens: number;
  model: string;
  cost_usd: number;
}

// Mirrors the backend's InterpretationReadModel: one narrative per reading,
// persisted the moment it is generated (the generate endpoint is idempotent —
// a repeat call returns this stored document without a new LLM call or charge).
export interface Interpretation {
  _id: string;
  reading_id: string;
  user_id: string;
  reading: string;
  model: string;
  // Absent (null) on documents migrated from before the usage ledger existed
  usage: InterpretationUsage | null;
  created_at: string;
  updated_at: string;
}

export type CreateReadingResult =
  | { ok: true; readingId: string }
  | { ok: false; error: string };

// unauthenticated: the session is gone (no cookie, or refresh failed) — the
// client can offer a login round-trip instead of a retry that cannot succeed
export type GenerateInterpretationResult =
  | { ok: true; data: Interpretation; remainingBudgetUsd: number }
  | { ok: false; error: string; unauthenticated?: boolean };
