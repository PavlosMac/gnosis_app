import { Cinzel, Crimson_Pro } from "next/font/google";
import Link from "next/link";
import "./tarot.css";
import Starfield from "@/components/Starfield";

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

export default function NotFound() {
  return (
    <main
      className={`min-h-screen relative overflow-hidden flex items-center justify-center ${cinzel.variable} ${crimsonPro.variable}`}
    >
      <Starfield />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 text-center animate-fadeIn">
        {/* Mystical symbol */}
        <div className="relative mb-8">
          <div className="w-32 h-32 rounded-full border-2 border-[#d4af37]/30 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full border border-[#d4af37]/20 flex items-center justify-center">
              <span className="text-6xl text-[#d4af37]/60 font-[var(--font-cinzel)]">?</span>
            </div>
          </div>
          {/* Two resting dots on the ring */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-[#d4af37]/40 rounded-full" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 bg-purple-400/40 rounded-full" />
        </div>

        {/* 404 text */}
        <h1 className="font-[var(--font-cinzel)] text-7xl md:text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-[#d4af37] via-[#f4d03f] to-[#c49b30] mb-4 tracking-wider">
          404
        </h1>

        {/* Message */}
        <h2 className="font-[var(--font-cinzel)] text-xl md:text-2xl text-[#e6d5b8] mb-3 tracking-wide">
          The Path is Shrouded
        </h2>
        <p className="font-[var(--font-crimson-pro)] text-[#e6d5b8]/70 text-lg max-w-md mb-8 leading-relaxed">
          The cards have not revealed this destination. Perhaps the stars guide you elsewhere.
        </p>

        {/* Decorative divider */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#d4af37]/50 to-transparent" />
          <div className="w-2 h-2 rotate-45 bg-[#d4af37]/40" />
          <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#d4af37]/50 to-transparent" />
        </div>

        {/* Return link */}
        <Link
          href="/"
          className="group relative px-8 py-3 overflow-hidden rounded-lg transition-all duration-300"
        >
          {/* Button background */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#d4af37]/20 via-[#f4d03f]/20 to-[#d4af37]/20" />
          <div className="absolute inset-[1px] bg-[#1a0033]/90 rounded-lg" />

          {/* Button content */}
          <span className="relative font-[var(--font-cinzel)] text-[#d4af37] tracking-widest text-sm uppercase group-hover:text-[#f4d03f] transition-colors">
            Return to the Oracle
          </span>
        </Link>
      </div>
    </main>
  );
}
