import { MAX_TAG_LENGTH } from "@/lib/validation/reading-schemas";
import type { PositionConfig } from "@/types/reading";

/**
 * Relationship spread: three pillars of three cards — the querent, the
 * relationship itself, and the other person. A position belongs to a row when
 * its (normalised) name starts with the row's key, and to a pillar either by
 * the pillar keyword its name ends with, or — when the two people have been
 * given custom names — by the shared name after the first " - " (see
 * groupByPillar; the row prefix itself never contains " - ", so the first
 * occurrence is always the template's own delimiter, even when the custom
 * name contains or starts with a dash). The querent/other keywords never
 * reach a named reading's
 * payload: naming a pillar swaps in template-built positions/descriptions so
 * the LLM sees only the person's name, never an identity claim like "querent"
 * (which would be wrong when the reading concerns two other people).
 */
export const RELATIONSHIP_PILLARS = [
  { key: "querent", label: "Querent" },
  { key: "relationship", label: "Relationship" },
  { key: "other", label: "Other" },
] as const;

/** Row keys, matched by prefix — shared across all three pillars */
const RELATIONSHIP_ROWS = ["current", "what is desired", "how to proceed"] as const;

export const CARDS_PER_PILLAR = RELATIONSHIP_ROWS.length;

export type PillarNameOverrides = { querent?: string; other?: string };

/** Positions/descriptions for a named person, one template per row */
const PERSON_ROW_TEMPLATES = [
  {
    position: (n: string) => `Current behaviour - ${n}`,
    description: (n: string) => `What is ${n}'s current behaviour?`,
  },
  {
    position: (n: string) => `What is desired - ${n}`,
    description: (n: string) => `What is desired by ${n}?`,
  },
  {
    position: (n: string) => `How to proceed - ${n}`,
    description: (n: string) => `How should ${n} proceed?`,
  },
] as const;

/** The rounds-1/2 stored format, e.g. "Current behaviour (Alice) - querent" — read-only legacy */
const LEGACY_PERSONALIZED = /\s*\((.+?)\)\s*-\s*(querent|other)\s*$/i;

const normalize = (position: string) => position.trim().toLowerCase();

/**
 * The whole token after the first " - " (or the whole string, if no " - "),
 * lowercased. The row prefix never contains " - ", so the first occurrence is
 * always the template's delimiter — using the first (rather than last) match
 * also keeps this correct when a custom name itself starts with or contains
 * " - ".
 */
const trailingTokenOf = (position: string): string => {
  const normalized = normalize(position);
  const at = normalized.indexOf(" - ");
  return at >= 0 ? normalized.slice(at + 3).trim() : normalized;
};

const keywordPillarIndexOf = (position: string) => {
  const token = trailingTokenOf(position);
  return RELATIONSHIP_PILLARS.findIndex((p) => token === p.key);
};

const rowIndexOf = (position: string) =>
  RELATIONSHIP_ROWS.findIndex((key) => normalize(position).startsWith(key));

/** The custom-name candidate: whatever follows the first " - ", if anything */
const nameSuffixOf = (position: string): string | undefined => {
  const at = position.indexOf(" - ");
  const suffix = at >= 0 ? position.slice(at + 3).trim() : "";
  return suffix || undefined;
};

/** The two pillars that can carry a custom name, with their column index */
const NAMED_PILLARS = [
  { key: "querent", pillar: 0 },
  { key: "other", pillar: 2 },
] as const;

/**
 * For each pillar, a fixed-length (CARDS_PER_PILLAR) array of indices into
 * `positions`, slotted by row rather than by order of appearance. Pillar
 * membership comes from the keyword suffix when present (default spreads and
 * legacy saved data); positions carrying a custom name instead share that name
 * as their suffix, and each distinct name claims the leftmost still-empty
 * people pillar in order of first appearance (the querent pillar's rows are
 * always written first, and a saved reading's cards keep their send order).
 */
export const groupByPillar = (positions: string[]): (number | undefined)[][] => {
  const groups: (number | undefined)[][] = RELATIONSHIP_PILLARS.map(() =>
    Array.from({ length: CARDS_PER_PILLAR }, () => undefined)
  );
  const named: { index: number; row: number; suffix: string }[] = [];
  positions.forEach((pos, i) => {
    const row = rowIndexOf(pos);
    if (row < 0) return;
    const pillar = keywordPillarIndexOf(pos);
    if (pillar >= 0) {
      groups[pillar][row] = i;
    } else {
      const suffix = nameSuffixOf(pos);
      if (suffix) named.push({ index: i, row, suffix: suffix.toLowerCase() });
    }
  });

  const openPillars = NAMED_PILLARS.map((p) => p.pillar).filter((p) =>
    groups[p].every((cell) => cell === undefined)
  );
  const pillarOfSuffix = new Map<string, number>();
  for (const { index, row, suffix } of named) {
    let pillar = pillarOfSuffix.get(suffix);
    if (pillar === undefined) {
      pillar = openPillars.shift();
      if (pillar === undefined) continue; // more names than people pillars — unresolvable
      pillarOfSuffix.set(suffix, pillar);
    }
    if (groups[pillar][row] === undefined) groups[pillar][row] = index;
  }
  return groups;
};

/** 9 positions, exactly one per pillar/row combination */
export const isRelationship = (positions: string[]) =>
  positions.length === RELATIONSHIP_PILLARS.length * CARDS_PER_PILLAR &&
  groupByPillar(positions).every((g) => g.every((idx) => idx !== undefined));

/**
 * A named reading's position list: the spread's config entries with each
 * renamed pillar's cells replaced by template-built {name, description} pairs
 * carrying only the person's name. Order is preserved; the relationship pillar
 * and any un-renamed pillar pass through from config untouched.
 */
export const buildNamedRelationshipPositions = (
  configPositions: PositionConfig[],
  names: PillarNameOverrides
): PositionConfig[] => {
  const groups = groupByPillar(configPositions.map((p) => p.name));
  const result = [...configPositions];
  for (const { key, pillar } of NAMED_PILLARS) {
    const name = names[key]?.trim();
    if (!name) continue;
    groups[pillar].forEach((index, row) => {
      if (index === undefined) return;
      result[index] = {
        name: PERSON_ROW_TEMPLATES[row].position(name),
        description: PERSON_ROW_TEMPLATES[row].description(name),
      };
    });
  }
  return result;
};

/**
 * Recover the custom names from a spread's position strings (live or as
 * stored on a saved reading), in either the templated or the legacy format.
 * Undefined when neither people pillar carries a name.
 */
export const extractPillarNames = (positions: string[]): PillarNameOverrides | undefined => {
  const groups = groupByPillar(positions);
  const names: PillarNameOverrides = {};
  for (const { key, pillar } of NAMED_PILLARS) {
    const index = groups[pillar].find((i) => i !== undefined);
    if (index === undefined) continue;
    const position = positions[index];
    const legacy = position.match(LEGACY_PERSONALIZED);
    if (legacy) {
      names[key] = legacy[1];
    } else if (keywordPillarIndexOf(position) < 0) {
      names[key] = nameSuffixOf(position);
    }
  }
  return names.querent || names.other ? names : undefined;
};

/**
 * Grid caption for a position: the name tail is dropped (the column header
 * carries the name), while default keyword suffixes stay as-is so unnamed
 * readings look exactly as before.
 */
export const positionCaption = (position: string, names?: PillarNameOverrides): string => {
  const withoutLegacy = position.replace(LEGACY_PERSONALIZED, "");
  if (withoutLegacy !== position) return withoutLegacy;
  const suffix = nameSuffixOf(position);
  const isName =
    suffix &&
    [names?.querent, names?.other].some((n) => n?.toLowerCase() === suffix.toLowerCase());
  return isName ? position.slice(0, position.indexOf(" - ")).trimEnd() : position;
};

/** Flat-context label: only the legacy format needs rewriting ("… (Pavlos) - querent" → "… - Pavlos") */
export const displayPositionName = (position: string): string =>
  position.replace(LEGACY_PERSONALIZED, (_, name) => ` - ${name}`);

/** Custom names as journal tags: lowercased, capped to the backend's tag length limit, deduped */
export const autoTagNames = (positions: string[]): string[] => {
  const names = extractPillarNames(positions);
  if (!names) return [];
  const tags = [names.querent, names.other]
    .filter((n): n is string => !!n?.trim())
    .map((n) => n.trim().toLowerCase().slice(0, MAX_TAG_LENGTH));
  return [...new Set(tags)];
};
