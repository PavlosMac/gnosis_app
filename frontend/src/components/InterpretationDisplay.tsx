import React from "react";
import TarotCard from "@/components/TarotCard";
import type { CardInterpretation } from "@/types/interpret";
import type { TarotCardData } from "@/types/models";

interface InterpretationDisplayProps {
  question?: string | null;
  cardInterpretations: CardInterpretation[];
  synthesis: string;
  cardVisuals?: Record<string, { card: TarotCardData; reversed: boolean } | null>;
}

export default function InterpretationDisplay({
  question,
  cardInterpretations,
  synthesis,
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

      {/* Card interpretations */}
      {cardInterpretations.map((interp, i) => {
        const visual = cardVisuals?.[interp.position];
        return (
          <div
            key={i}
            className="flex flex-col sm:flex-row gap-5 pb-6 border-b border-[#d4af37]/15 last:border-0 last:pb-0"
          >
            {/* Card visual */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              {visual && (
                <TarotCard
                  card={{ ...visual.card, reversed: visual.reversed }}
                  small={true}
                  showMeaning={false}
                />
              )}
              <span
                className="text-xs text-[#e6d5b8]/60 text-center"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {interp.position}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{
                  backgroundColor:
                    interp.orientation === "reversed"
                      ? "rgba(138,43,226,0.25)"
                      : "rgba(212,175,55,0.15)",
                  color:
                    interp.orientation === "reversed"
                      ? "#c084fc"
                      : "#d4af37",
                  border: `1px solid ${interp.orientation === "reversed" ? "rgba(138,43,226,0.4)" : "rgba(212,175,55,0.4)"}`,
                  fontFamily: "'Cinzel', serif",
                }}
              >
                {interp.orientation}
              </span>
            </div>

            {/* Interpretation text */}
            <div className="flex-1">
              <h3
                className="text-[#d4af37] font-semibold text-base mb-2 tracking-wide"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {interp.card_name}
              </h3>
              <p
                className="text-[#e6d5b8]/85 text-sm sm:text-base leading-relaxed"
                style={{ fontFamily: "'Crimson Pro', serif" }}
              >
                {interp.interpretation}
              </p>
            </div>
          </div>
        );
      })}

      {/* Synthesis */}
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
          ✦ The Oracle Speaks ✦
        </h3>
        <p
          className="text-[#e6d5b8]/90 text-sm sm:text-base leading-relaxed"
          style={{ fontFamily: "'Crimson Pro', serif" }}
        >
          {synthesis}
        </p>
      </div>
    </div>
  );
}
