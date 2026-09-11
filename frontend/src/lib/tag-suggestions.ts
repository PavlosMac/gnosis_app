import type { TagSummary } from "@/types/reading";

export const MAX_TAG_SUGGESTIONS = 8;
export const MIN_TAG_QUERY_LENGTH = 2;

/**
 * Filter the user's tag vocabulary down to the suggestions for the combobox.
 *
 * Nothing is suggested until the query is at least MIN_TAG_QUERY_LENGTH
 * characters. `available` arrives most-used first from the backend and that
 * order is preserved; prefix matches rank ahead of other substring matches,
 * keeping the given order within each group.
 */
export const filterTagSuggestions = (
  available: TagSummary[],
  selected: string[],
  query: string,
  max: number = MAX_TAG_SUGGESTIONS
): TagSummary[] => {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < MIN_TAG_QUERY_LENGTH) return [];

  const selectedSet = new Set(selected.map((tag) => tag.trim().toLowerCase()));
  const seen = new Set<string>();
  const candidates = available.filter((tag) => {
    const name = tag.name.toLowerCase();
    if (selectedSet.has(name) || seen.has(name)) return false;
    seen.add(name);
    return true;
  });

  const prefixMatches: TagSummary[] = [];
  const substringMatches: TagSummary[] = [];
  for (const tag of candidates) {
    const name = tag.name.toLowerCase();
    if (name.startsWith(normalizedQuery)) prefixMatches.push(tag);
    else if (name.includes(normalizedQuery)) substringMatches.push(tag);
  }
  return [...prefixMatches, ...substringMatches].slice(0, max);
};

/** Parse a comma-separated `tags` URL param into a clean tag list */
export const parseTagsParam = (raw: string | undefined): string[] => {
  if (!raw) return [];
  const tags: string[] = [];
  for (const part of raw.split(",")) {
    const tag = part.trim().toLowerCase();
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  return tags;
};

/** Serialize a tag list back into the comma-separated `tags` URL param */
export const serializeTags = (tags: string[]): string => tags.join(",");
