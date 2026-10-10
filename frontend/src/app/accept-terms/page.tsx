import { redirect } from "next/navigation";
import LegalDocument from "@/components/LegalDocument";
import { staleConsents } from "@/lib/consent";
import { CURRENT_VERSIONS } from "@/lib/legal-documents";
import { isVersionString } from "@/lib/legal-versions";
import { getCurrentUser } from "@/lib/session";
import AcceptForm from "./accept-form";
import type { StaleDocument } from "./accept-form";

// Outside /user on purpose: the /user layout redirects here, so living under
// it would loop. The proxy matcher covers this path (logged-out redirect and
// token refresh); the check below is the backstop.
const AcceptTermsPage = async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/user/login");

  const stale = staleConsents(user.consents, CURRENT_VERSIONS);
  if (stale.length === 0) redirect("/user/profile");

  const documents: StaleDocument[] = stale.map((id) => {
    const previous = user.consents?.[id]?.version;
    return {
      id,
      version: CURRENT_VERSIONS[id],
      // Only a well-formed stored version becomes a link
      previousVersion: isVersionString(previous) ? previous : undefined,
      document: <LegalDocument id={id} />,
    };
  });

  return <AcceptForm documents={documents} />;
};

export default AcceptTermsPage;
