import "server-only";
import { redirect } from "next/navigation";
import { CURRENT_VERSIONS } from "@/lib/legal-documents";
import { onboardingRedirect } from "@/lib/onboarding";
import { getCurrentUser } from "@/lib/session";

/**
 * Send a logged-in user with an outstanding onboarding step (stale
 * Terms/Privacy; later, payment) to that step. Called at the top of every page
 * under /user and /superadmin except the exempt delete-account page.
 *
 * Pages, not only the layout, because a layout is not re-rendered on
 * client-side navigation: a user who entered /user through the exempt page, or
 * whose tab was open when a document version changed, would otherwise browse
 * the rest of the section ungated. `getCurrentUser` is request-cached, so this
 * costs no extra request. No user = nothing to do (the proxy owns logged-out
 * redirects).
 */
export const enforceOnboarding = async (): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) return;
  const destination = onboardingRedirect(user, CURRENT_VERSIONS);
  if (destination) redirect(destination);
};
