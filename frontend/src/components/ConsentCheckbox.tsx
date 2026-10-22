"use client";

import { useCallback, useState } from "react";
import { AuthCheckbox } from "@/components/AuthField";
import LegalDocumentModal from "@/components/LegalDocumentModal";
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

      {open && <LegalDocumentModal id={id} document={document} onClose={close} />}
    </>
  );
};

export default ConsentCheckbox;
