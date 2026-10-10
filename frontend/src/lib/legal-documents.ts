import "server-only";
import type { ComponentType } from "react";
import { LEGAL_REGISTRY } from "@/lib/legal-registry.generated";
import {
  LEGAL_DOCUMENT_IDS,
  isVersionString,
  newestVersion,
  sortVersions,
  type LegalDocumentId,
  type LegalVersions,
} from "@/lib/legal-versions";

/** Every published version of a document, oldest first */
export const listVersions = (id: LegalDocumentId): string[] =>
  sortVersions(Object.keys(LEGAL_REGISTRY[id]));

/** The newest dated file is the current version — nothing else declares one */
export const currentVersion = (id: LegalDocumentId): string => {
  const version = newestVersion(listVersions(id));
  if (!version) throw new Error(`No published version of legal document "${id}"`);
  return version;
};

/** What a new registration or re-consent records. Computed once at module load. */
export const CURRENT_VERSIONS: LegalVersions = Object.fromEntries(
  LEGAL_DOCUMENT_IDS.map((id) => [id, currentVersion(id)])
) as LegalVersions;

/**
 * The MDX component for one dated version, or null when that version was never
 * published. Only keys of the generated registry are ever imported, so a
 * version taken from a URL can never reach `import()` as a raw path.
 */
export const loadDocument = async (
  id: LegalDocumentId,
  version: string
): Promise<ComponentType | null> => {
  if (!isVersionString(version) || !Object.hasOwn(LEGAL_REGISTRY[id], version)) return null;
  const loaded = await LEGAL_REGISTRY[id][version]();
  return loaded.default;
};
