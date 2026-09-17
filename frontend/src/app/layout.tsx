import type { Metadata } from "next";
import Script from 'next/script';
import "./globals.css";
import ProfileNav from '@/components/ProfileNav';
import { AuthProvider } from '@/app/providers/auth-provider';
import { getCurrentUser } from '@/lib/session';

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
        <AuthProvider initialUser={user}>
        <ProfileNav />
        {children}
        </AuthProvider>

        {/* Google tag (gtag.js) */}
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-PNCJVPB14N"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-PNCJVPB14N');
          `}
        </Script>
      </body>
    </html>
  );
}
