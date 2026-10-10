import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LegalPageShell from "@/components/LegalPageShell";
import { listVersions } from "@/lib/legal-documents";
import { DOCUMENT_TITLES, LEGAL_DOCUMENT_IDS, isLegalDocumentId } from "@/lib/legal-versions";

interface LegalVersionPageProps {
  params: Promise<{ doc: string; version: string }>;
}

export const generateStaticParams = () =>
  LEGAL_DOCUMENT_IDS.flatMap((doc) => listVersions(doc).map((version) => ({ doc, version })));

export const generateMetadata = async ({ params }: LegalVersionPageProps): Promise<Metadata> => {
  const { doc, version } = await params;
  return isLegalDocumentId(doc)
    ? { title: `${DOCUMENT_TITLES[doc]} (${version}) | Tarot Divinations` }
    : {};
};

/** One dated version — exactly what a user accepted on that date (public) */
const LegalVersionPage = async ({ params }: LegalVersionPageProps) => {
  const { doc, version } = await params;
  if (!isLegalDocumentId(doc) || !listVersions(doc).includes(version)) notFound();
  return <LegalPageShell id={doc} version={version} />;
};

export default LegalVersionPage;
