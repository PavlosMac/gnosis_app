import { staleConsents, type UserConsents } from "@/lib/consent";
import type { LegalVersions } from "@/lib/legal-versions";
import type { UserStatus } from "@/types/auth";

export type OnboardingRoute = "/verify-email" | "/accept-terms";

interface OnboardingUser {
  status: UserStatus;
  consents?: UserConsents;
}

/**
 * Where a logged-in user must go before they may use the app, or null when
 * nothing is outstanding. The single place onboarding order is decided — a
 * later payment step adds one branch here (`payment_required` → "/user/billing").
 *
 * The backend refuses a session to a pending account, so the first branch is a
 * backstop for a status change mid-session rather than a normal path.
 */
export const onboardingRedirect = (
  user: OnboardingUser,
  currentVersions: LegalVersions
): OnboardingRoute | null => {
  if (user.status === "pending_verification") return "/verify-email";
  if (staleConsents(user.consents, currentVersions).length > 0) return "/accept-terms";
  return null;
};

/** Request header the proxy sets so server layouts (which get no pathname)
    can tell which page is being rendered */
export const PATHNAME_HEADER = "x-pathname";

// A user who declines a new document version must still be able to leave:
// deleting the account may never require accepting the terms first.
const EXEMPT_PATHS = ["/user/profile/delete-account"];

/** Pages under the onboarding gate that stay reachable while something is
    outstanding. Unknown path = not exempt. */
export const isOnboardingExempt = (pathname: string | null | undefined): boolean =>
  !!pathname && EXEMPT_PATHS.includes(pathname);

/** What a guarded server action answers to a user who IS logged in but has an
    onboarding step outstanding. Public pages (e.g. /reading) are outside the
    layout gate, so the message itself has to say where to go. */
export const ONBOARDING_REQUIRED_MESSAGE =
  "Please accept the updated Terms and Privacy Policy to continue. Open your profile to review them.";
