import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AuthProvider } from "@/app/providers/auth-provider";
import { isRegistrationEnabled } from "@/lib/feature-flags";
import { CURRENT_VERSIONS } from "@/lib/legal-documents";
import { onboardingRedirect } from "@/lib/onboarding";

interface SuperadminLayoutProps {
  children: React.ReactNode;
}

const SuperadminLayout = async ({ children }: SuperadminLayoutProps) => {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/user/login");
  }

  if (!user.isSuperadmin) {
    redirect("/user/profile");
  }

  const destination = onboardingRedirect(user, CURRENT_VERSIONS);
  if (destination) redirect(destination);

  return (
    <AuthProvider initialUser={user} registrationEnabled={isRegistrationEnabled()}>
      {children}
    </AuthProvider>
  );
};

export default SuperadminLayout;
