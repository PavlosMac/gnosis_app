import { getCurrentUser } from "@/lib/session";
import { AuthProvider } from "@/app/providers/auth-provider";

interface UserLayoutProps {
  children: React.ReactNode;
}

const UserLayout = async ({ children }: UserLayoutProps) => {
  const user = await getCurrentUser();

  return <AuthProvider initialUser={user}>{children}</AuthProvider>;
};

export default UserLayout;
