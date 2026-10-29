"use client";
import React from "react";
import Link from "next/link";
import { Cinzel, Crimson_Pro } from "next/font/google";
import "@/app/tarot.css";
import Starfield from "@/components/Starfield";

// Shared font instances - prevents re-instantiation across pages
const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-cinzel",
});

const crimsonPro = Crimson_Pro({
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  variable: "--font-crimson-pro",
});

interface TarotPageLayoutProps {
  children: React.ReactNode;
  showBackButton?: boolean;
  backButtonHref?: string;
  backButtonLabel?: string;
  /** Allow the page to scroll (long content such as a full deck) */
  scrollable?: boolean;
  /** Override the content wrapper's padding/sizing */
  contentClassName?: string;
}

const TarotPageLayout: React.FC<TarotPageLayoutProps> = ({
  children,
  showBackButton = true,
  backButtonHref = "/",
  backButtonLabel = "Portal",
  scrollable = false,
  contentClassName = "pt-10 px-4 pb-10",
}) => {
  return (
    <main
      className={`min-h-screen relative ${scrollable ? 'overflow-y-auto' : 'overflow-hidden'} ${cinzel.variable} ${crimsonPro.variable}`}
    >
      <Starfield />

      {/* Content */}
      <div className={`relative z-10 flex flex-col items-center justify-start ${contentClassName}`}>
        {/* Back button */}
        {showBackButton && (
          <Link
            href={backButtonHref}
            className="absolute top-4 left-4 z-50 flex items-center gap-2 px-4 py-2
                       text-[#d4af37]/70 hover:text-[#d4af37] transition-colors"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            <span>←</span>
            <span className="text-sm tracking-wider">{backButtonLabel}</span>
          </Link>
        )}

        {children}
      </div>
    </main>
  );
};

export default TarotPageLayout;

// Re-export font variables for components that need direct access
export { cinzel, crimsonPro };
