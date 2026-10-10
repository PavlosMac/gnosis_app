import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CURRENT_VERSIONS } from "@/lib/legal-documents";
import { PATHNAME_HEADER, isOnboardingExempt, onboardingRedirect } from "@/lib/onboarding";
import { getCurrentUser } from "@/lib/session";

interface UserLayoutProps {
  children: React.ReactNode;
}

/**
 * The onboarding gate for /user/*: a logged-in user with something
 * outstanding (stale Terms/Privacy; later, payment) is sent to that step.
 * Unauthenticated visitors (login, register) have no user and pass through —
 * the proxy owns the logged-out redirect. A layout is not re-rendered on
 * client-side navigation, so each page under it also calls
 * `enforceOnboarding()`; this layout catches the first entry. Server actions
 * are covered by neither and call `requireConsentedUser()` themselves.
 */
const UserLayout = async ({ children }: UserLayoutProps) => {
  const user = await getCurrentUser();
  if (user) {
    const destination = onboardingRedirect(user, CURRENT_VERSIONS);
    if (destination && !isOnboardingExempt((await headers()).get(PATHNAME_HEADER))) {
      redirect(destination);
    }
  }
  return <>{children}</>;
};

export default UserLayout;
