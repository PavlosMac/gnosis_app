import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AuthProvider } from "@/app/providers/auth-provider";

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

  return <AuthProvider initialUser={user}>{children}</AuthProvider>;
};

export default SuperadminLayout;
