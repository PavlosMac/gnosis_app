"use client";

import { useActionState, useState } from "react";
import AuthPageShell, {
  AuthErrorBanner,
  AuthFootnote,
  AuthLink,
  AuthSubmitButton,
} from "@/components/AuthPageShell";
import ConsentCheckbox from "@/components/ConsentCheckbox";
import { CONSENT_FIELDS, type LegalDocumentId } from "@/lib/legal-versions";
import { logout } from "@/app/user/logout/actions";
import ContactSupportModal from "@/app/user/profile/ContactSupportModal";
import { acceptTerms } from "./actions";
import type { ConsentFormState } from "@/types/auth";

export interface StaleDocument {
  id: LegalDocumentId;
  /** The current version being asked for */
  version: string;
  /** What the user accepted before, when a record exists */
  previousVersion?: string;
  /** Server-rendered current document */
  document: React.ReactNode;
}

interface AcceptFormProps {
  documents: StaleDocument[];
}

const initialState: ConsentFormState = { success: false };
const BODY = { fontFamily: "'Crimson Pro', serif" } as const;

const AcceptForm = ({ documents }: AcceptFormProps) => {
  const [state, formAction, pending] = useActionState(acceptTerms, initialState);
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <AuthPageShell
      glyph={<>&#9878;</>}
      title="Updated Terms"
      backButtonHref="/"
      backButtonLabel="Portal"
    >
      <p className="text-center text-[#e6d5b8]/70 text-sm mb-6" style={BODY}>
        Please review and accept the following to continue using your account.
      </p>

      <AuthErrorBanner message={state.error} className="mb-6" />

      <form action={formAction} className="space-y-6">
        <div className="space-y-4">
          {documents.map(({ id, version, previousVersion, document }) => (
            <div key={id}>
              <ConsentCheckbox
                id={id}
                document={document}
                error={state.fieldErrors?.[CONSENT_FIELDS[id]]?.[0]}
              />
              <p
                className="text-[#e6d5b8]/40 text-xs"
                style={{ ...BODY, marginTop: "0.25rem", paddingLeft: "1.875rem" }}
              >
                Version {version}
                {previousVersion && (
                  <>
                    {" · previously accepted: "}
                    <AuthLink href={`/legal/${id}/${previousVersion}`}>{previousVersion}</AuthLink>
                  </>
                )}
              </p>
            </div>
          ))}
        </div>

        <AuthSubmitButton pending={pending} pendingLabel="Saving...">
          Continue
        </AuthSubmitButton>
      </form>

      {/* Declining is not penalised beyond losing the service that needs the
          terms: the user can leave, or remove the account, without accepting */}
      <form action={logout} className="mt-6 text-center">
        <button
          type="submit"
          className="text-sm text-[#d4af37]/70 hover:text-[#d4af37] transition-colors underline-offset-4 hover:underline"
          style={BODY}
        >
          Log out
        </button>
      </form>
      <AuthFootnote className="mt-3">
        <AuthLink href="/user/profile/delete-account">Delete my account</AuthLink>
        {" · "}
        <button
          type="button"
          onClick={() => setSupportOpen(true)}
          className="text-[#d4af37]/70 hover:text-[#d4af37] transition-colors underline-offset-4 hover:underline"
        >
          Contact support
        </button>
      </AuthFootnote>

      {/* Support (and so data-access requests) must stay reachable without
          accepting the new version; the profile, where it normally lives, is
          behind this gate */}
      {supportOpen && <ContactSupportModal onClose={() => setSupportOpen(false)} />}
    </AuthPageShell>
  );
};

export default AcceptForm;
