import type { Metadata } from "next";
import Link from "next/link";
import TarotPageLayout from "@/components/TarotPageLayout";
import { GUIDE_CHAPTERS } from "@/lib/guide-chapters";

export const metadata: Metadata = {
  title: "Guide | Tarot Divinations",
  description:
    "How to use Tarot Divinations: create an account, make and save a reading, ask the Oracle for an interpretation, find your readings and reach support.",
};

const HEADING_FONT = { fontFamily: "'Cinzel', serif" } as const;
const BODY_FONT = { fontFamily: "'Crimson Pro', serif" } as const;

/** Hub of the guide: one card per chapter, each chapter is its own page at /guide/<slug> */
export default function GuidePage() {
  return (
    <TarotPageLayout scrollable>
      <div className="w-full max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#d4af37] tracking-wider mb-4"
            style={{ ...HEADING_FONT, textShadow: "0 0 30px rgba(212,175,55,0.4)" }}
          >
            The Guide
          </h1>
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="w-24 h-px bg-gradient-to-r from-transparent via-[#d4af37]/60 to-[#d4af37]" />
            <span className="text-[#d4af37] text-xl">☥</span>
            <div className="w-24 h-px bg-gradient-to-l from-transparent via-[#d4af37]/60 to-[#d4af37]" />
          </div>
          <p
            className="text-[#e6d5b8]/70 text-lg sm:text-xl mt-6 max-w-2xl mx-auto leading-relaxed"
            style={BODY_FONT}
          >
            Everything you need to get value from Tarot Divinations, one short chapter at a time.
          </p>
        </div>

        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ listStyle: "none", padding: 0 }}>
          {GUIDE_CHAPTERS.map((chapter, i) => (
            <li key={chapter.slug}>
              <Link
                href={`/guide/${chapter.slug}`}
                className="block h-full rounded-2xl border border-[#d4af37]/20 bg-gradient-to-b from-[#1a0033]/80 to-[#0a0015]/80 backdrop-blur-sm p-5 hover:border-[#d4af37]/60 transition-colors"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[#d4af37]/70 text-xl" aria-hidden>
                    {chapter.symbol}
                  </span>
                  <span className="text-[#d4af37]/50 text-xs tracking-widest uppercase" style={HEADING_FONT}>
                    Chapter {i + 1}
                  </span>
                </div>
                <h2 className="text-lg text-[#d4af37] tracking-wide mb-2" style={HEADING_FONT}>
                  {chapter.title}
                </h2>
                <p className="text-[#e6d5b8]/80 leading-relaxed" style={BODY_FONT}>
                  {chapter.summary}
                </p>
                {chapter.requiresAccount && (
                  <p className="text-[#e6d5b8]/50 text-sm mt-3 italic" style={BODY_FONT}>
                    Needs an account
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ol>

        <div className="text-center mt-12 mb-8">
          <Link
            href="/reading"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-lg border border-[#d4af37]/40 bg-gradient-to-r from-[#d4af37]/10 to-transparent hover:border-[#d4af37] hover:bg-[#d4af37]/20 transition-all duration-500"
          >
            <span className="text-sm text-[#d4af37] tracking-widest uppercase" style={HEADING_FONT}>
              Consult the Oracle
            </span>
            <span className="text-xl text-[#d4af37]">→</span>
          </Link>
        </div>
      </div>
    </TarotPageLayout>
  );
}
