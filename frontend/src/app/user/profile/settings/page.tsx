import { redirect } from "next/navigation";
import { enforceOnboarding } from "@/lib/onboarding-gate";
import { getCurrentUser } from "@/lib/session";
import AccountSettingsCard from "./AccountSettingsCard";

/** /user/profile/settings — guarded like the profile: onboarding first, then a
    signed-in user, whose consents feed the Agreements block. The agreement text
    is not rendered here: the rows fetch it from `loadAgreementDocument` when one
    is opened. */
const AccountSettingsPage = async () => {
  await enforceOnboarding();

  const user = await getCurrentUser();
  if (!user) redirect("/user/login");

  return <AccountSettingsCard consents={user.consents} />;
};

export default AccountSettingsPage;
