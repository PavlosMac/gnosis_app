"use client";

import { useActionState } from "react";
import AuthPageShell, {
  AuthErrorBanner,
  AuthFootnote,
  AuthLink,
  AuthSubmitButton,
} from "@/components/AuthPageShell";
import ConsentCheckbox from "@/components/ConsentCheckbox";
import type { LegalDocumentId } from "@/lib/legal-versions";
import { saveConsent } from "./actions";
import type { ConsentFormState } from "@/types/auth";

export interface ConsentDocument {
  id: LegalDocumentId;
  version: string;
  /** The user's stored acceptance is for the current version */
  accepted: boolean;
  /** Formatted acceptance date, when accepted */
  acceptedOn?: string;
  /** Server-rendered current document */
  document: React.ReactNode;
}

interface ManageConsentFormProps {
  documents: ConsentDocument[];
}

const initialState: ConsentFormState = { success: false };
const BODY = { fontFamily: "'Crimson Pro', serif" } as const;

const ManageConsentForm = ({ documents }: ManageConsentFormProps) => {
  const [state, formAction, pending] = useActionState(saveConsent, initialState);

  return (
    <AuthPageShell
      glyph={<>&#9878;</>}
      title="Agreements"
      backButtonHref="/user/profile"
      backButtonLabel="Sanctum"
    >
      <p className="text-center text-[#e6d5b8]/70 text-sm mb-6" style={BODY}>
        Review the documents that govern your account. Open either one to read
        it in full.
      </p>

      <AuthErrorBanner message={state.error} className="mb-6" />
      {state.success && (
        <p
          className="text-center text-sm text-[#d4af37]/90 border border-[#d4af37]/20 rounded-lg px-4 py-3 bg-[#d4af37]/5 mb-6"
          style={BODY}
          role="status"
        >
          Your agreements have been saved.{state.notice ? ` ${state.notice}` : ""}
        </p>
      )}

      <form action={formAction} className="space-y-6">
        <div className="space-y-4">
          {documents.map(({ id, version, accepted, acceptedOn, document }) => (
            <div key={id}>
              {/* After a save every ticked box was just accepted, so the boxes
                  keep reflecting the stored state when React resets the form */}
              <ConsentCheckbox id={id} document={document} defaultChecked={accepted} />
              <p
                className="text-[#e6d5b8]/40 text-xs"
                style={{ ...BODY, marginTop: "0.25rem", paddingLeft: "1.875rem" }}
              >
                Version {version}
                {acceptedOn ? ` · accepted ${acceptedOn}` : " · not yet accepted"}
              </p>
            </div>
          ))}
        </div>

        <AuthSubmitButton pending={pending} pendingLabel="Saving...">
          Save
        </AuthSubmitButton>
      </form>

      <p className="text-center text-[#e6d5b8]/50 text-sm mt-6" style={BODY}>
        Acceptance cannot be withdrawn while keeping the account, because the
        service cannot be provided without these documents. To decline, log
        out or{" "}
        <AuthLink href="/user/profile/delete-account">delete your account</AuthLink>.
      </p>
      <AuthFootnote className="mt-3">
        <AuthLink href="/user/profile">Return to the Sanctum</AuthLink>
      </AuthFootnote>
    </AuthPageShell>
  );
};

export default ManageConsentForm;
