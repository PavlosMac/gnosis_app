"use client";

import { useCallback, useState } from "react";
import { AuthCheckbox } from "@/components/AuthField";
import SanctumModal from "@/components/SanctumModal";
import { CONSENT_FIELDS, DOCUMENT_TITLES, type LegalDocumentId } from "@/lib/legal-versions";

// The Privacy Policy is acknowledged, not consented to (the lawful basis for
// account data is the contract), so its wording is "read", never "accept"
const LABEL_PREFIX: Record<LegalDocumentId, string> = {
  terms: "I accept the",
  privacy: "I have read the",
};

interface ConsentCheckboxProps {
  id: LegalDocumentId;
  /** The rendered document (a server-rendered <LegalDocument/> node) */
  document: React.ReactNode;
  error?: string;
  defaultChecked?: boolean;
}

/**
 * One acceptance checkbox whose label opens the full document in a modal
 * without leaving the form. Shared by registration, the re-consent gate and
 * the profile's consent page so the wording cannot drift between them.
 */
const ConsentCheckbox = ({ id, document, error, defaultChecked }: ConsentCheckboxProps) => {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const name = CONSENT_FIELDS[id];

  return (
    <>
      <AuthCheckbox name={name} error={error} defaultChecked={defaultChecked}>
        <label htmlFor={name}>{LABEL_PREFIX[id]}</label>{" "}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[#d4af37]/80 hover:text-[#d4af37] underline underline-offset-4 transition-colors"
        >
          {DOCUMENT_TITLES[id]}
        </button>
      </AuthCheckbox>

      {open && (
        <SanctumModal title={DOCUMENT_TITLES[id]} size="lg" onClose={close}>
          {document}
          <div className="text-center" style={{ marginTop: "1.5rem" }}>
            <button
              type="button"
              onClick={close}
              className="px-8 py-2 rounded-lg border border-[#d4af37]/60 text-[#d4af37]
                         tracking-widest uppercase text-sm hover:border-[#d4af37]
                         hover:bg-[#d4af37]/20 transition-all duration-300"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Close
            </button>
          </div>
        </SanctumModal>
      )}
    </>
  );
};

export default ConsentCheckbox;
