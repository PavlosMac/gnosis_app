import TarotChart from "@/components/TarotChart";
import Link from "next/link";
import { Cinzel, Crimson_Pro } from "next/font/google";
import "../tarot.css";
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

export default function ChartPage() {
  return (
    <main
      className={`min-h-screen relative overflow-hidden ${cinzel.variable} ${crimsonPro.variable}`}
    >
      <Starfield />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-start pt-10 px-4 pb-10">
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

        <TarotChart />
      </div>
    </main>
  );
}
