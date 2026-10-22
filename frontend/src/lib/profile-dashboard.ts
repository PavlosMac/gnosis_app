import { listHref } from "@/lib/reading-list-context";
import type { UserConsents } from "@/lib/consent";
import {
  DOCUMENT_TITLES,
  LEGAL_DOCUMENT_IDS,
  isVersionString,
  type LegalDocumentId,
} from "@/lib/legal-versions";

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

const DRY_CAPTION = "The chalice runs dry";

/** The line under the chalice: only the dry state is worth words — the profile
    shows no currency, the fill level says the rest */
export const chaliceCaption = (remaining: number): string | null =>
  remaining <= 0 ? DRY_CAPTION : null;

/** The chalice's accessible title, from the 0..1 fill fraction. It follows the
    drawn state: dry only at zero, full where the chalice is drawn full, and a
    percentage kept inside 1..99 so a sliver never reads "0%". */
export const chaliceTitle = (fraction: number): string => {
  const state = chaliceState(fraction);
  if (state === "empty") return "Remaining readings: the chalice runs dry";
  if (state === "full") return "Remaining readings: the chalice is full";
  const percent = Math.min(99, Math.max(1, Math.round(fraction * 100)));
  return `Remaining readings: the chalice is ${percent}% full`;
};

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

/** The profile's Name row: the display name, else first + last, else "Seeker" */
export const accountName = (user: {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
}): string =>
  user.displayName ||
  [user.firstName, user.lastName].filter(Boolean).join(" ") ||
  "Seeker";

export interface AgreementRow {
  id: LegalDocumentId;
  title: string;
  /** A consent record exists for this document */
  accepted: boolean;
  /** The exact version accepted when it is well-formed; null means show the current one */
  version: string | null;
  detail: string;
}

/** One row per legal document for the profile's Agreements block */
export const agreementRowModel = (consents: UserConsents | undefined): AgreementRow[] =>
  LEGAL_DOCUMENT_IDS.map((id) => {
    const record = consents?.[id];
    const title = DOCUMENT_TITLES[id];
    if (!record) {
      return { id, title, accepted: false, version: null, detail: "Not yet recorded" };
    }
    // The stored version is whatever string the backend holds; only a
    // well-formed one is passed on
    const version = isVersionString(record.version) ? record.version : null;
    const acceptedAt = new Date(record.accepted_at);
    const detail = Number.isNaN(acceptedAt.getTime())
      ? "accepted"
      : `accepted ${formatReadingDate(record.accepted_at)}`;
    return { id, title, accepted: true, version, detail };
  });
