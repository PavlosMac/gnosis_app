// Position names for the Significators chart, shared by the live layout, the
// saved-reading layout and the payload builder.
// Spread name; must match readings-config.json.
export const SIGNIFICATORS_SPREAD = "Significators";

export const SIGNIFICATOR_POSITIONS = [
  "day number",
  "life number",
  "star sign",
  "decanate",
  "court royal",
] as const;

const LIFE_NUMBER_KEY_RE = /^(life number) \d+$/i;

const normalize = (positions: string[]) => positions.map((p) => p.trim().toLowerCase());

/** True when any position is a significator position (allowing the legacy "life number 1" form). */
export const isSignificators = (positions: string[]) => {
  const normalized = normalize(positions);
  return SIGNIFICATOR_POSITIONS.some((pos) =>
    normalized.some((np) => np === pos || np.startsWith(`${pos} `))
  );
};

/** "life number 2" -> "life number". Every other position (incl. "Card 1") is returned untouched. */
export const basePosition = (position: string): string =>
  position.replace(LIFE_NUMBER_KEY_RE, "$1");

/**
 * Saved readings can hold repeated positions (life numbers are stored un-numbered).
 * Re-suffix repeats " 1..N" so they can key a Record; unique positions and the
 * legacy "life number 1/2" shape pass through unchanged.
 */
export const uniquePositionKeys = (positions: string[]): string[] => {
  const totals = new Map<string, number>();
  positions.forEach((p) => totals.set(p, (totals.get(p) ?? 0) + 1));
  const seen = new Map<string, number>();
  return positions.map((p) => {
    if ((totals.get(p) ?? 0) < 2) return p;
    const n = (seen.get(p) ?? 0) + 1;
    seen.set(p, n);
    return `${p} ${n}`;
  });
};
