"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import InterpretationDisplay from "@/components/InterpretationDisplay";
import InterpretationModal from "@/components/InterpretationModal";
import SpreadCards from "@/components/SpreadCards";
import type { CardVisuals } from "@/components/SpreadCards";
import type { Interpretation } from "@/types/interpret";


interface InterpretationSectionProps {
  readingId: string;
  spreadName: string;
  question: string | null;
  birthDate?: string;
  cardVisuals: CardVisuals;
  // The reading's one interpretation — generate is idempotent, so once this
  // exists there is nothing further to generate
  interpretation: Interpretation | null;
}

const InterpretationSection: React.FC<InterpretationSectionProps> = ({
  readingId,
  spreadName,
  question,
  birthDate,
  cardVisuals,
  interpretation,
}) => {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);
  const handleComplete = useCallback(() => {
    router.refresh();
  }, [router]);

  const usage = interpretation?.usage ?? null;

  return (
    <>
      {interpretation ? (
        <>
          <div className="rounded-2xl border border-[#d4af37]/20 bg-gradient-to-b from-[#1a0033]/80 to-[#0a0015]/80 backdrop-blur-sm p-5 sm:p-8">
            <InterpretationDisplay
              question={question}
              narrative={interpretation.reading}
              cardVisuals={cardVisuals}
            />
          </div>
          <div className="mt-4 text-xs text-[#e6d5b8]/30 text-center sm:text-left">
            <span style={{ fontFamily: "'Crimson Pro', serif" }}>
              Model: {interpretation.model}
              {usage && (
                <>
                  {" "}&middot;{" "}
                  {(usage.prompt_tokens + usage.completion_tokens).toLocaleString()} tokens
                </>
              )}
            </span>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-[#d4af37]/20 bg-gradient-to-b from-[#1a0033]/80 to-[#0a0015]/80 backdrop-blur-sm p-5 sm:p-8">
          <SpreadCards cardVisuals={cardVisuals} />
          <div className="mt-8 flex justify-center">
            <button
              onClick={openModal}
              className="px-8 sm:px-10 py-3 sm:py-4 bg-gradient-to-br from-[#8a2be2]/80 to-[#5a1a9e]/80 text-[#e6d5b8] rounded-lg
                         shadow-lg hover:shadow-[#8a2be2]/40 transition-all duration-300 font-bold text-base sm:text-lg
                         hover:scale-105 active:scale-95 border border-[#8a2be2]/40"
              style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.1em" }}
            >
              ✦ Oracle Interpretation ✦
            </button>
          </div>
        </div>
      )}

      {modalOpen && (
        <InterpretationModal
          readingId={readingId}
          spreadName={spreadName}
          question={question ?? undefined}
          birthDate={birthDate}
          cardVisuals={cardVisuals}
          onClose={closeModal}
          onComplete={handleComplete}
        />
      )}
    </>
  );
};

export default InterpretationSection;
