import type { Metadata } from "next";
import "./globals.css";
import ProfileNav from '@/components/ProfileNav';
import { AuthProvider } from '@/app/providers/auth-provider';
import { getCurrentUser } from '@/lib/session';
import { isRegistrationEnabled } from '@/lib/feature-flags';

export const metadata: Metadata = {
  title: "Tarot Divinations",
  description: "Ancient wisdom and divine guidance through the sacred art of Tarot",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <AuthProvider initialUser={user} registrationEnabled={isRegistrationEnabled()}>
        <ProfileNav />
        {children}
        </AuthProvider>
      </body>
    </html>
  );
}
