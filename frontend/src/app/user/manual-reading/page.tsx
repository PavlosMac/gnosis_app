import { redirect } from "next/navigation";
import TarotPageLayout from "@/components/TarotPageLayout";
import TarotGame from "@/components/TarotGame";
import { getCurrentUser } from "@/lib/session";

export default async function ManualReadingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/user/login");

  return (
    <TarotPageLayout
      backButtonHref="/user/profile"
      backButtonLabel="Sanctum"
      scrollable
      contentClassName="pt-12 sm:pt-10 px-1 sm:px-4 pb-4 sm:pb-10 min-h-screen"
    >
      <TarotGame user={user} mode="manual" />
    </TarotPageLayout>
  );
}
