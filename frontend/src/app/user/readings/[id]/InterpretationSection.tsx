"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import InterpretationDisplay from "@/components/InterpretationDisplay";
import InterpretationModal from "@/components/InterpretationModal";
import TarotCard from "@/components/TarotCard";
import { saveInterpretation } from "@/app/user/interpret/actions";
import {
  readInterpretationBackup,
  writeInterpretationBackup,
} from "@/lib/interpretation-backup";
import type { TarotCardData } from "@/types/models";
import type { SavedCard } from "@/types/reading";
import type { Interpretation } from "@/types/interpret";

interface InterpretationSectionProps {
  readingId: string;
  spreadName: string;
  question: string | null;
  birthDate?: string;
  cardVisuals: Record<string, { card: TarotCardData; reversed: boolean } | null>;
  cards: SavedCard[];
  interpretation: Interpretation | null;
}

const InterpretationSection: React.FC<InterpretationSectionProps> = ({
  readingId,
  spreadName,
  question,
  birthDate,
  cardVisuals,
  cards,
  interpretation,
}) => {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [hasBackup, setHasBackup] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState("");

  // localStorage is client-only; read after mount to avoid hydration mismatch
  useEffect(() => {
    setHasBackup(readInterpretationBackup(readingId) !== null);
  }, [readingId, interpretation]);

  const handleRestore = useCallback(async () => {
    const backup = readInterpretationBackup(readingId);
    if (!backup) return;
    setRestoring(true);
    setRestoreError("");
    const result = await saveInterpretation(readingId, backup);
    if (result.ok) {
      if (interpretation) writeInterpretationBackup(readingId, interpretation);
      router.refresh();
    } else {
      setRestoreError(result.error);
    }
    setRestoring(false);
  }, [readingId, interpretation, router]);

  return (
    <>
      {interpretation ? (
        <>
          <div className="rounded-2xl border border-[#d4af37]/20 bg-gradient-to-b from-[#1a0033]/80 to-[#0a0015]/80 backdrop-blur-sm p-5 sm:p-8">
            <InterpretationDisplay
              question={question}
              cardInterpretations={interpretation.card_interpretations}
              synthesis={interpretation.synthesis}
              cardVisuals={cardVisuals}
            />
          </div>
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#e6d5b8]/30">
            <span style={{ fontFamily: "'Crimson Pro', serif" }}>
              Model: {interpretation.model} &middot;{" "}
              {interpretation.tokens_used.toLocaleString()} tokens
            </span>
            <button
              onClick={() => setShowModal(true)}
              className="text-[#d4af37]/60 hover:text-[#d4af37] transition-colors tracking-wider text-xs"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              ✦ New Interpretation ✦
            </button>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-[#d4af37]/20 bg-gradient-to-b from-[#1a0033]/80 to-[#0a0015]/80 backdrop-blur-sm p-5 sm:p-8">
          <div className="flex flex-wrap justify-center gap-6">
            {cards.map((saved) => {
              const visual = cardVisuals[saved.position];
              return (
                <div key={saved.position} className="flex flex-col items-center gap-2">
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
                    {saved.position}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => setShowModal(true)}
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

      {hasBackup && (
        <div className="mt-3 text-center">
          <button
            onClick={handleRestore}
            disabled={restoring}
            className="text-xs text-[#d4af37]/50 hover:text-[#d4af37] transition-colors tracking-wider
                       disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {restoring ? "Restoring..." : "Restore previous interpretation"}
          </button>
          {restoreError && (
            <p
              className="text-red-400 text-xs mt-1"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              {restoreError}
            </p>
          )}
        </div>
      )}

      {showModal && (
        <InterpretationModal
          readingId={readingId}
          spreadName={spreadName}
          question={question ?? undefined}
          birthDate={birthDate}
          cardVisuals={cardVisuals}
          savedInterpretation={interpretation}
          onClose={() => setShowModal(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </>
  );
};

export default InterpretationSection;
