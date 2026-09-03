import React from "react";
import SpreadCards from "@/components/SpreadCards";
import type { CardVisuals } from "@/components/SpreadCards";

interface InterpretationDisplayProps {
  question?: string | null;
  narrative: string;
  cardVisuals: CardVisuals;
}

export default function InterpretationDisplay({
  question,
  narrative,
  cardVisuals,
}: InterpretationDisplayProps) {
  return (
    <div className="flex flex-col gap-8">
      {/* Original question */}
      {question && question.trim().length > 0 && (
        <div
          className="text-center px-4 py-3 rounded-lg border border-[#d4af37]/15"
          style={{ background: "rgba(212,175,55,0.04)" }}
        >
          <p
            className="text-[#e6d5b8]/50 text-xs uppercase tracking-widest mb-1"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Your Question
          </p>
          <p
            className="text-[#e6d5b8]/80 text-sm sm:text-base italic whitespace-pre-wrap"
            style={{ fontFamily: "'Crimson Pro', serif" }}
          >
            &ldquo;{question.trim()}&rdquo;
          </p>
        </div>
      )}

      {/* The spread itself, laid out as in the game */}
      <SpreadCards cardVisuals={cardVisuals} />

      {/* Narrative */}
      <div
        className="rounded-lg p-5 border border-[#d4af37]/20"
        style={{
          background: "rgba(212,175,55,0.05)",
        }}
      >
        <h3
          className="text-[#d4af37] font-bold text-lg mb-3 tracking-wider text-center"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          ✦ Reading Interpretation ✦
        </h3>
        <p
          className="text-[#e6d5b8]/90 text-sm sm:text-base leading-relaxed whitespace-pre-wrap"
          style={{ fontFamily: "'Crimson Pro', serif" }}
        >
          {narrative}
        </p>
      </div>
    </div>
  );
}
