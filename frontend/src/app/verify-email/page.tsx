import VerifyEmailForm from "./verify-email-form";

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

// The backend emails links as {FRONTEND_BASE_URL}/verify-email?token=... — this
// route path is a contract with the API. Opening the link only renders a
// Confirm button; nothing is posted until the user clicks it, so a mail
// scanner that pre-fetches the link cannot burn the token.
const VerifyEmailPage = async ({ searchParams }: VerifyEmailPageProps) => {
  const { token } = await searchParams;
  return (
    <VerifyEmailForm token={typeof token === "string" && token ? token : undefined} />
  );
};

export default VerifyEmailPage;
