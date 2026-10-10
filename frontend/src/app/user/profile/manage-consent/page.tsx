import { redirect } from "next/navigation";
import { enforceOnboarding } from "@/lib/onboarding-gate";
import LegalDocument from "@/components/LegalDocument";
import { CURRENT_VERSIONS } from "@/lib/legal-documents";
import { LEGAL_DOCUMENT_IDS } from "@/lib/legal-versions";
import { formatReadingDate } from "@/lib/profile-dashboard";
import { getCurrentUser } from "@/lib/session";
import ManageConsentForm from "./manage-consent-form";
import type { ConsentDocument } from "./manage-consent-form";

/** Self-service consent: review both current documents and re-record
    acceptance at any time, not only when a version changes. */
const ManageConsentPage = async () => {
  await enforceOnboarding();

  const user = await getCurrentUser();
  if (!user) redirect("/user/login");

  const documents: ConsentDocument[] = LEGAL_DOCUMENT_IDS.map((id) => {
    const record = user.consents?.[id];
    const accepted = record?.version === CURRENT_VERSIONS[id];
    return {
      id,
      version: CURRENT_VERSIONS[id],
      accepted,
      acceptedOn:
        accepted && record && !Number.isNaN(new Date(record.accepted_at).getTime())
          ? formatReadingDate(record.accepted_at)
          : undefined,
      document: <LegalDocument id={id} />,
    };
  });

  return <ManageConsentForm documents={documents} />;
};

export default ManageConsentPage;
