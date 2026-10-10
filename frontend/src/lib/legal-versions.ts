// Pure helpers for the versioned legal documents — no fs, no MDX, so they are
// unit-testable and safe to import from client components.

export const LEGAL_DOCUMENT_IDS = ["terms", "privacy"] as const;

export type LegalDocumentId = (typeof LEGAL_DOCUMENT_IDS)[number];

/** The current version of each document, e.g. `{ terms: "2026-10-04", ... }` */
export type LegalVersions = Record<LegalDocumentId, string>;

export const DOCUMENT_TITLES: Record<LegalDocumentId, string> = {
  terms: "Terms and Conditions",
  privacy: "Privacy Policy",
};

/** A version is the document's effective date as an ISO string — and the MDX
    filename. ISO dates sort as plain strings, so no date parsing anywhere. */
const VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isLegalDocumentId = (value: unknown): value is LegalDocumentId =>
  typeof value === "string" && (LEGAL_DOCUMENT_IDS as readonly string[]).includes(value);

export const isVersionString = (value: unknown): value is string =>
  typeof value === "string" && VERSION_PATTERN.test(value);

/** `"2026-10-04.mdx"` → `"2026-10-04"`; null for anything else, so a stray
    file can never become the current version */
export const versionFromFilename = (filename: string): string | null => {
  if (!filename.endsWith(".mdx")) return null;
  const version = filename.slice(0, -".mdx".length);
  return isVersionString(version) ? version : null;
};

export const sortVersions = (versions: readonly string[]): string[] => [...versions].sort();

export const newestVersion = (versions: readonly string[]): string | undefined =>
  sortVersions(versions).at(-1);

/** FormData field name of each document's acceptance checkbox */
export const CONSENT_FIELDS: Record<LegalDocumentId, string> = {
  terms: "acceptTerms",
  privacy: "acceptPrivacy",
};

/** A version for display, e.g. "4 Oct 2026". The version is a calendar date, not a
    moment in time, so this renders in UTC — a local-timezone render (the default
    for `toLocaleDateString`) would shift the displayed day near midnight on a server
    with a non-UTC offset, even though the version string itself never changes. */
export const formatVersionDate = (version: string): string =>
  new Date(version).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
