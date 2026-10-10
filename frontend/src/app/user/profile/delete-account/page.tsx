import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import DeleteAccountForm from "./delete-account-form";

// Exempt from the onboarding gate (see isOnboardingExempt): leaving must never
// require accepting new terms first.
const DeleteAccountPage = async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/user/login");

  return <DeleteAccountForm />;
};

export default DeleteAccountPage;
