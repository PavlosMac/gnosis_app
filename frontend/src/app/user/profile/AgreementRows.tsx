"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import LegalDocumentModal from "@/components/LegalDocumentModal";
import type { UserConsents } from "@/lib/consent";
import type { LegalDocumentId } from "@/lib/legal-versions";
import { agreementRowModel } from "@/lib/profile-dashboard";
import { loadAgreementDocument } from "./settings/actions";

interface AgreementRowsProps {
  /** From `getCurrentUser()` on the page — no extra fetch */
  consents: UserConsents | undefined;
}

const CINZEL = { fontFamily: "'Cinzel', serif" } as const;
const CRIMSON = { fontFamily: "'Crimson Pro', serif" } as const;

const Note = ({ children }: { children: string }) => (
  <p className="text-[#e6d5b8]/60 text-center" style={CRIMSON}>
    {children}
  </p>
);

/** What the user agreed to: one row per legal document, opening the exact
    version accepted in a modal, plus the way to review them at any time. The
    document is rendered by a server action when a row is opened, so the page
    carries no legal text until someone asks for it. */
const AgreementRows = ({ consents }: AgreementRowsProps) => {
  const [open, setOpen] = useState<LegalDocumentId | null>(null);
  const [body, setBody] = useState<React.ReactNode>(null);
  // Only the latest request may fill the modal (a slow first answer must not overwrite a second row)
  const latest = useRef(0);

  const openDocument = (id: LegalDocumentId, version: string | null) => {
    const request = ++latest.current;
    setOpen(id);
    setBody(null);
    const settle = (node: React.ReactNode) => {
      if (request === latest.current) setBody(node);
    };
    loadAgreementDocument(id, version)
      .then((node) => settle(node ?? <Note>This document could not be loaded.</Note>))
      .catch(() => settle(<Note>This document could not be loaded.</Note>));
  };

  const closeDocument = () => {
    latest.current++;
    setOpen(null);
    setBody(null);
  };

  return (
    <div className="pt-4 pb-4 border-t border-[#d4af37]/10">
      <div className="flex items-center justify-between gap-4" style={{ marginBottom: "0.75rem" }}>
        <span className="text-[#e6d5b8]/60 text-sm tracking-wider uppercase" style={CINZEL}>
          Agreements
        </span>
        <Link
          href="/user/profile/manage-consent"
          className="text-[#d4af37]/60 hover:text-[#d4af37] text-xs tracking-wider uppercase transition-colors"
          style={CINZEL}
        >
          Review / change
        </Link>
      </div>

      <ul className="space-y-2">
        {agreementRowModel(consents).map(({ id, title, accepted, version, detail }) => (
          <li key={id} className="flex items-center justify-between gap-4">
            <span className="flex items-center min-w-0" style={{ gap: "0.5rem" }}>
              <span
                className={accepted ? "text-[#d4af37]" : "text-[#e6d5b8]/30"}
                aria-hidden="true"
              >
                {accepted ? "✓" : "☐"}
              </span>
              <button
                type="button"
                onClick={() => openDocument(id, version)}
                className="text-[#e6d5b8] hover:text-[#d4af37] text-sm truncate transition-colors underline-offset-4 hover:underline"
                style={CRIMSON}
              >
                {title}
              </button>
            </span>
            <span className="text-[#e6d5b8]/50 text-xs shrink-0" style={CRIMSON}>
              {detail}
            </span>
          </li>
        ))}
      </ul>

      {open && (
        <LegalDocumentModal
          id={open}
          document={body ?? <Note>Unrolling the scroll&hellip;</Note>}
          onClose={closeDocument}
        />
      )}
    </div>
  );
};

export default AgreementRows;
