import ResetPasswordForm from "./reset-password-form";

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

// The backend emails links as {FRONTEND_BASE_URL}/reset-password?token=... —
// this route path is a contract with the API.
const ResetPasswordPage = async ({ searchParams }: ResetPasswordPageProps) => {
  const { token } = await searchParams;
  return (
    <ResetPasswordForm
      token={typeof token === "string" && token ? token : undefined}
    />
  );
};

export default ResetPasswordPage;
