import {
  CONSENT_FIELDS,
  LEGAL_DOCUMENT_IDS,
  type LegalDocumentId,
  type LegalVersions,
} from "@/lib/legal-versions";

/** One acceptance as the backend stores it under `consents.<document>` */
export interface ConsentRecord {
  version: string;
  accepted_at: string;
}

export type UserConsents = Partial<Record<LegalDocumentId, ConsentRecord>>;

/**
 * The documents whose accepted version is behind the current one. String
 * equality is the only comparison: stored !== current means stale.
 *
 * `undefined` consents means the backend predates the feature (the key is
 * always present once it ships, `{}` for legacy users) — nothing is stale then,
 * so the gate is skipped rather than locking everyone out.
 */
export const staleConsents = (
  consents: UserConsents | undefined,
  current: LegalVersions
): LegalDocumentId[] =>
  consents === undefined
    ? []
    : LEGAL_DOCUMENT_IDS.filter((id) => consents[id]?.version !== current[id]);

/** Which acceptance checkboxes a submitted form had ticked (a checkbox posts
    "on" when ticked and is absent otherwise) */
export const tickedDocuments = (formData: FormData): LegalDocumentId[] =>
  LEGAL_DOCUMENT_IDS.filter((id) => formData.get(CONSENT_FIELDS[id]) === "on");

/**
 * Body for POST /api/v1/auth/consent: the ticked documents at the CURRENT
 * versions. Versions always come from the server-side registry, never from
 * the form, so a client cannot record acceptance of a version that was not shown.
 */
export const consentPayload = (
  ticked: readonly LegalDocumentId[],
  current: LegalVersions
): Partial<LegalVersions> =>
  Object.fromEntries(ticked.map((id) => [id, current[id]])) as Partial<LegalVersions>;
