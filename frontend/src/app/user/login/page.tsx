import LoginForm from "./login-form";
import { isRegistrationEnabled } from "@/lib/feature-flags";

interface LoginPageProps {
  searchParams: Promise<{ from?: string | string[] }>;
}

// `from` is set by the proxy on redirect, and by "Log in to save" in the
// interpretation modal; the login action validates it before redirecting.
const LoginPage = async ({ searchParams }: LoginPageProps) => {
  const { from } = await searchParams;
  return (
    <LoginForm
      registrationEnabled={isRegistrationEnabled()}
      from={typeof from === "string" ? from : undefined}
    />
  );
};

export default LoginPage;
