import { z } from "zod";

export const interpretCardSchema = z.object({
  name: z.string().trim().min(1).max(100),
  position: z.string().trim().min(1).max(100),
  orientation: z.enum(["upright", "reversed"]),
  position_description: z.string().trim().max(2000).optional(),
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
  cards: z.array(interpretCardSchema).min(1).max(22),
});
