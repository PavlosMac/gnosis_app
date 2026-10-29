import TarotLanding from "@/components/TarotLanding";
import { Cinzel, Crimson_Pro } from "next/font/google";
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

export default function TarotPage() {
  return (
    <main
      className={`min-h-screen relative overflow-hidden ${cinzel.variable} ${crimsonPro.variable}`}
    >
      <Starfield />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-start pt-10 px-4 pb-10">
        <TarotLanding />
      </div>
    </main>
  );
}
