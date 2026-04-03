import { z } from "zod";

export const interpretCardSchema = z.object({
  name: z.string().trim().min(1).max(100),
  position: z.string().trim().min(1).max(100),
  orientation: z.enum(["upright", "reversed"]),
});

export const interpretRequestSchema = z.object({
  question: z
    .string()
    .trim()
    .min(5, "Please enter at least 5 characters.")
    .max(500, "Question must be 500 characters or fewer."),
  cards: z.array(interpretCardSchema).min(1).max(22),
});
