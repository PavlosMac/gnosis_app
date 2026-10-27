import LegalDocument from "@/components/LegalDocument";
import { publicFetch } from "@/lib/api-client";
import type { InviteLookupResponse } from "@/types/auth";
import AcceptInviteForm, { type InviteProblem } from "./accept-invite-form";

interface AcceptInvitePageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

// The backend emails invite links as {FRONTEND_BASE_URL}/accept-invite?token=...
// — this route path is a contract with the API. It lives at the app root, outside
// /user, so the proxy's registration gate and the onboarding gate never apply:
// an invitee has no account to be gated on and REGISTRATION_ENABLED is not
// consulted. The lookup only peeks at the token; nothing is consumed until the
// invitee submits the form.
const AcceptInvitePage = async ({ searchParams }: AcceptInvitePageProps) => {
  const { token: raw } = await searchParams;
  const token = typeof raw === "string" && raw ? raw : undefined;

  let email: string | undefined;
  let problem: InviteProblem | undefined;
  if (!token) {
    problem = "invalid";
  } else {
    const result = await publicFetch<InviteLookupResponse>(
      `/api/v1/auth/invite?token=${encodeURIComponent(token)}`,
      { method: "GET" }
    );
    if (result.ok) email = result.data.email;
    else if (result.status === 410) problem = "expired";
    else if (result.status === 400) problem = "invalid";
    else problem = "unavailable";
  }

  return (
    <AcceptInviteForm
      token={token}
      email={email}
      problem={problem}
      terms={<LegalDocument id="terms" />}
      privacy={<LegalDocument id="privacy" />}
    />
  );
};

export default AcceptInvitePage;
