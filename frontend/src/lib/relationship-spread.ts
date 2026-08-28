/**
 * Relationship spread: three pillars of three cards — the querent, the
 * relationship itself, and the other person. A position belongs to a pillar
 * when its (normalised) name ends with the pillar's key, and to a row when
 * it starts with the row's key, so positions can be renamed or reordered
 * freely as long as those prefix/suffix keys stay.
 */
export const RELATIONSHIP_PILLARS = [
  { key: "querent", label: "Querent" },
  { key: "relationship", label: "Relationship" },
  { key: "other", label: "Other" },
] as const;

/** Row keys, matched by prefix — shared across all three pillars */
const RELATIONSHIP_ROWS = ["current", "what is desired", "how to proceed"] as const;

export const CARDS_PER_PILLAR = RELATIONSHIP_ROWS.length;

const normalize = (position: string) => position.trim().toLowerCase();

const pillarIndexOf = (position: string) =>
  RELATIONSHIP_PILLARS.findIndex((p) => normalize(position).endsWith(p.key));

const rowIndexOf = (position: string) =>
  RELATIONSHIP_ROWS.findIndex((key) => normalize(position).startsWith(key));

/**
 * For each pillar, a fixed-length (CARDS_PER_PILLAR) array of indices into
 * `positions`, slotted by row (current / desired / how-to-proceed) rather
 * than by order of appearance — so a missing or reordered position leaves a
 * gap in its own row instead of shifting the rest of the pillar up.
 */
export const groupByPillar = (positions: string[]): (number | undefined)[][] => {
  const groups: (number | undefined)[][] = RELATIONSHIP_PILLARS.map(() =>
    Array.from({ length: CARDS_PER_PILLAR }, () => undefined)
  );
  positions.forEach((pos, i) => {
    const pillar = pillarIndexOf(pos);
    const row = rowIndexOf(pos);
    if (pillar >= 0 && row >= 0) groups[pillar][row] = i;
  });
  return groups;
};

/** 9 positions, exactly one per pillar/row combination */
export const isRelationship = (positions: string[]) =>
  positions.length === RELATIONSHIP_PILLARS.length * CARDS_PER_PILLAR &&
  groupByPillar(positions).every((g) => g.every((idx) => idx !== undefined));
