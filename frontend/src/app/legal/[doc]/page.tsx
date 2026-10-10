import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LegalPageShell from "@/components/LegalPageShell";
import { DOCUMENT_TITLES, LEGAL_DOCUMENT_IDS, isLegalDocumentId } from "@/lib/legal-versions";

interface LegalPageProps {
  params: Promise<{ doc: string }>;
}

export const generateStaticParams = () => LEGAL_DOCUMENT_IDS.map((doc) => ({ doc }));

export const generateMetadata = async ({ params }: LegalPageProps): Promise<Metadata> => {
  const { doc } = await params;
  return isLegalDocumentId(doc) ? { title: `${DOCUMENT_TITLES[doc]} | Tarot Divinations` } : {};
};

/** The current version of a legal document (public) */
const LegalPage = async ({ params }: LegalPageProps) => {
  const { doc } = await params;
  if (!isLegalDocumentId(doc)) notFound();
  return <LegalPageShell id={doc} />;
};

export default LegalPage;
