import Link from "next/link";
import { Cinzel, Crimson_Pro } from "next/font/google";
import "../tarot.css";
import TarotGame from "@/components/TarotGame";
import { getCurrentUser } from "@/lib/session";
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

export default async function ReadingPage() {
  const user = await getCurrentUser();

  return (
    <main
      className={`min-h-screen relative overflow-y-auto ${cinzel.variable} ${crimsonPro.variable}`}
    >
      <Starfield />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-start pt-12 sm:pt-10 px-1 sm:px-4 pb-4 sm:pb-10 min-h-screen">
        {/* Back button */}
        <Link
          href="/"
          className="absolute top-4 left-4 z-50 flex items-center gap-2 px-4 py-2
                     text-[#d4af37]/70 hover:text-[#d4af37] transition-colors"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          <span>←</span>
          <span className="text-sm tracking-wider">Portal</span>
        </Link>

        <TarotGame user={user} />
      </div>
    </main>
  );
}
