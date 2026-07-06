import { z } from "zod";

export const MAX_TAGS_PER_READING = 5;
export const MAX_TAG_LENGTH = 15;

export const updateTagsSchema = z.object({
  tags: z
    .array(z.string().max(MAX_TAG_LENGTH, "tags should be comma separated"))
    .max(MAX_TAGS_PER_READING, `Max ${MAX_TAGS_PER_READING} tags`),
});
