"use client";
import React, { useMemo } from "react";
import Link from "next/link";
import { Cinzel, Crimson_Pro } from "next/font/google";
import "../tarot.css";

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
}

// Generate deterministic star positions (avoids hydration mismatch)
const generateStars = () =>
  [...Array(100)].map((_, i) => ({
    left: `${(i * 7.3 + 13) % 100}%`,
    top: `${(i * 11.7 + 23) % 100}%`,
    animationDelay: `${(i * 0.37) % 3}s`,
    animationDuration: `${2 + (i * 0.29) % 2}s`,
  }));

const TarotPageLayout: React.FC<TarotPageLayoutProps> = ({
  children,
  showBackButton = true,
  backButtonHref = "/",
  backButtonLabel = "Portal",
}) => {
  // Memoize stars to prevent recalculation
  const stars = useMemo(generateStars, []);

  return (
    <main
      className={`min-h-screen relative overflow-hidden ${cinzel.variable} ${crimsonPro.variable}`}
    >
      {/* Mystical starfield background */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#0a0015] via-[#1a0033] to-[#2d1b4e]">
        {/* Animated stars */}
        <div className="absolute inset-0 opacity-60">
          {stars.map((star, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-twinkle"
              style={star}
            />
          ))}
        </div>
        {/* Ambient glow effects */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,rgba(212,175,55,0.15),transparent_50%)]" />
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_70%_60%,rgba(138,43,226,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.7)_100%)]" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-start pt-10 px-4 pb-10">
        {/* Back button */}
        {showBackButton && (
          <Link
            href={backButtonHref}
            className="absolute top-4 left-4 z-20 flex items-center gap-2 px-4 py-2
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
