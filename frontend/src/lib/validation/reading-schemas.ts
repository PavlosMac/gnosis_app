import { z } from "zod";

export const MAX_TAGS_PER_READING = 5;
export const MAX_TAG_LENGTH = 25;

export const updateTagsSchema = z.object({
  tags: z
    .array(z.string().max(MAX_TAG_LENGTH, `Tag too long (max ${MAX_TAG_LENGTH} characters)`))
    .max(MAX_TAGS_PER_READING, `Max ${MAX_TAGS_PER_READING} tags`),
});
