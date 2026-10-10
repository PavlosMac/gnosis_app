import LoginForm from "./login-form";

interface LoginPageProps {
  searchParams: Promise<{ from?: string | string[] }>;
}

// `from` is set by the proxy on redirect, and by "Log in to save" in the
// interpretation modal; the login action validates it before redirecting.
const LoginPage = async ({ searchParams }: LoginPageProps) => {
  const { from } = await searchParams;
  return (
    <LoginForm from={typeof from === "string" ? from : undefined} />
  );
};

export default LoginPage;
