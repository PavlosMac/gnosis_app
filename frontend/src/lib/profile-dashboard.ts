import { listHref } from "@/lib/reading-list-context";

/**
 * How full the chalice is, 0..1 — null when the figures can't yield a level
 * (non-finite or negative). A budget of exactly $0 is a real state (an account
 * capped by an admin) and reads as a dry chalice, not as missing data.
 */
export const chaliceFill = (
  remaining: number | undefined,
  budget: number | undefined
): number | null => {
  if (
    typeof remaining !== "number" ||
    typeof budget !== "number" ||
    !Number.isFinite(remaining) ||
    !Number.isFinite(budget) ||
    budget < 0
  )
    return null;
  if (budget === 0) return 0;
  return Math.min(1, Math.max(0, remaining / budget));
};

export type ChaliceState = "full" | "partial" | "low" | "empty";

export const chaliceState = (fraction: number): ChaliceState => {
  if (fraction <= 0) return "empty";
  if (fraction < 0.2) return "low";
  if (fraction >= 0.98) return "full";
  return "partial";
};

/** "$2.41" — fixed two decimals, negatives clamp to $0.00 (deterministic, no Intl) */
export const formatUsd = (amount: number): string =>
  `$${Math.max(0, amount).toFixed(2)}`;

/** The line under the chalice: "$2.41 of $3.00 remains", or the dry-chalice line */
export const budgetCaption = (remaining: number, budget: number): string =>
  remaining <= 0
    ? "The chalice runs dry"
    : `${formatUsd(remaining)} of ${formatUsd(budget)} remains`;

/** "10 Sept 2026" — the readings journal's date format */
export const formatReadingDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const truncateQuestion = (text: string | null, max = 120): string | null => {
  if (!text) return null;
  return text.length > max ? text.slice(0, max) + "…" : text;
};

/** The readings list filtered to one tag — shared serializer, so it can't drift */
export const tagHref = (tag: string): string => listHref({ page: 1, tags: tag });
