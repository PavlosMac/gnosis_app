"use client";

import SanctumModal from "@/components/SanctumModal";
import { DOCUMENT_TITLES, type LegalDocumentId } from "@/lib/legal-versions";

interface LegalDocumentModalProps {
  id: LegalDocumentId;
  /** The rendered document (a server-rendered <LegalDocument/> node) */
  document: React.ReactNode;
  onClose: () => void;
}

/** A legal document read in place — the consent checkboxes and the profile's
    Agreements rows open the same dialog, so nobody leaves the page to read it. */
const LegalDocumentModal = ({ id, document, onClose }: LegalDocumentModalProps) => (
  <SanctumModal title={DOCUMENT_TITLES[id]} size="lg" onClose={onClose}>
    {document}
    <div className="text-center" style={{ marginTop: "1.5rem" }}>
      <button
        type="button"
        onClick={onClose}
        className="px-8 py-2 rounded-lg border border-[#d4af37]/60 text-[#d4af37]
                   tracking-widest uppercase text-sm hover:border-[#d4af37]
                   hover:bg-[#d4af37]/20 transition-all duration-300"
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        Close
      </button>
    </div>
  </SanctumModal>
);

export default LegalDocumentModal;
