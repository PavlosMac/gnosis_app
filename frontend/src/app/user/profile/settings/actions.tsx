"use server";

import type { ReactNode } from "react";
import LegalDocument from "@/components/LegalDocument";
import { listVersions } from "@/lib/legal-documents";
import { isLegalDocumentId } from "@/lib/legal-versions";

/** One legal document, rendered on the server when a row of the Agreements block
    is opened — the settings page itself ships no document text. Shows the accepted
    version, or the current one when that is missing or has no file. Arguments come
    from the client, so they are validated before anything is rendered. */
export const loadAgreementDocument = async (
  id: string,
  version: string | null
): Promise<ReactNode> => {
  if (!isLegalDocumentId(id)) return null;
  return (
    <LegalDocument id={id} version={version && listVersions(id).includes(version) ? version : undefined} />
  );
};
