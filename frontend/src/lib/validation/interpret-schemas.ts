import { z } from "zod";

export const interpretCardSchema = z.object({
  name: z.string().trim().min(1).max(100),
  position: z.string().trim().min(1).max(100),
  orientation: z.enum(["upright", "reversed"]),
  position_description: z.string().trim().max(500).optional(),
});

export const interpretRequestSchema = z.object({
  spread_name: z.string().trim().min(1).max(200),
  question: z
    .string()
    .trim()
    .min(5, "Please enter at least 5 characters.")
    .max(500, "Question must be 500 characters or fewer.")
    .optional(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cards: z.array(interpretCardSchema).min(1).max(11),
});

export const interpretationSettingsSchema = z.object({
  lens: z.enum(["traditional", "psychological", "esoteric", "alchemical"]),
  intent: z.enum(["reflective", "predictive"]),
  depth: z.number().int().min(0).max(100),
});

export const saveInterpretationSchema = z.object({
  card_interpretations: z.array(
    z.object({
      card_name: z.string(),
      position: z.string(),
      orientation: z.enum(["upright", "reversed"]),
      interpretation: z.string(),
    })
  ),
  synthesis: z.string(),
  model: z.string(),
  tokens_used: z.number().int().min(0),
  settings: interpretationSettingsSchema,
});
