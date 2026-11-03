import { listHref } from "@/lib/reading-list-context";
import type { UserConsents } from "@/lib/consent";
import {
  DOCUMENT_TITLES,
  LEGAL_DOCUMENT_IDS,
  isVersionString,
  type LegalDocumentId,
} from "@/lib/legal-versions";

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

/** The Sanctum's greeting: the first name, else "Seeker" */
export const greetingName = (user: { firstName: string | null }): string =>
  user.firstName?.trim() || "Seeker";

/** "First Last" from whichever parts exist; null when the account has neither */
export const fullName = (user: {
  firstName?: string | null;
  lastName?: string | null;
}): string | null =>
  [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ") || null;

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
