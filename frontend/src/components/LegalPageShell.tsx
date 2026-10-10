import Link from "next/link";
import TarotPageLayout from "@/components/TarotPageLayout";
import LegalDocument from "@/components/LegalDocument";
import { LEGAL_DOCUMENT_IDS, DOCUMENT_TITLES, type LegalDocumentId } from "@/lib/legal-versions";

interface LegalPageShellProps {
  id: LegalDocumentId;
  version?: string;
}

/** Page chrome shared by /legal/[doc] and /legal/[doc]/[version] */
const LegalPageShell = ({ id, version }: LegalPageShellProps) => (
  <TarotPageLayout backButtonHref="/" backButtonLabel="Portal" scrollable>
    <div className="w-full max-w-3xl mx-auto mt-8 sm:mt-16 px-4 sm:px-0">
      <div className="relative rounded-2xl border border-[#d4af37]/20 bg-gradient-to-b from-[#1a0033]/80 to-[#0a0015]/80 backdrop-blur-sm p-5 sm:p-10">
        <LegalDocument id={id} version={version} variant="page" />
      </div>

      <p
        className="text-center text-[#e6d5b8]/50 text-sm"
        style={{ fontFamily: "'Crimson Pro', serif", marginTop: "1.5rem" }}
      >
        {LEGAL_DOCUMENT_IDS.filter((other) => other !== id).map((other) => (
          <Link
            key={other}
            href={`/legal/${other}`}
            className="text-[#d4af37]/70 hover:text-[#d4af37] underline-offset-4 hover:underline"
          >
            {DOCUMENT_TITLES[other]}
          </Link>
        ))}
      </p>
    </div>
  </TarotPageLayout>
);

export default LegalPageShell;
