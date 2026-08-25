"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import InterpretationDisplay from "@/components/InterpretationDisplay";
import InterpretationModal from "@/components/InterpretationModal";
import TarotCard from "@/components/TarotCard";
import { takeUnsavedInterpretation } from "@/lib/interpretation-stash";
import { LENS_LABELS, INTENT_LABELS } from "@/lib/interpretation-defaults";
import type { TarotCardData } from "@/types/models";
import type { SavedCard } from "@/types/reading";
import type { Interpretation, InterpretationLens } from "@/types/interpret";


interface InterpretationSectionProps {
  readingId: string;
  spreadName: string;
  question: string | null;
  birthDate?: string;
  cardVisuals: Record<string, { card: TarotCardData; reversed: boolean } | null>;
  cards: SavedCard[];
  interpretations: Interpretation[];
}

const InterpretationSection: React.FC<InterpretationSectionProps> = ({
  readingId,
  spreadName,
  question,
  birthDate,
  cardVisuals,
  cards,
  interpretations,
}) => {
  const router = useRouter();
  // null = closed; initialResult set when reopening in preview from a stash
  const [modal, setModal] = useState<{ initialResult?: Interpretation } | null>(null);
  const [activeLens, setActiveLens] = useState<InterpretationLens | null>(null);

  // An interpretation stashed before a "Log in to save" round-trip: reopen the
  // modal in preview so the user can finish saving. sessionStorage is
  // client-only, so this runs after mount rather than in an initializer.
  useEffect(() => {
    const stashed = takeUnsavedInterpretation(readingId);
    if (stashed) setModal({ initialResult: stashed });
  }, [readingId]);

  const openModal = useCallback(() => setModal({}), []);
  const closeModal = useCallback(() => setModal(null), []);
  const handleSaved = useCallback(
    (saved: Interpretation) => {
      setActiveLens(saved.settings.lens);
      router.refresh();
    },
    [router]
  );

  const ordered = [...interpretations].sort((a, b) =>
    (a.created_at ?? "").localeCompare(b.created_at ?? "")
  );
  const active =
    ordered.find((i) => i.settings.lens === activeLens) ?? ordered[0] ?? null;

  return (
    <>
      {active ? (
        <>
          {/* Lens tabs */}
          {ordered.length > 1 && (
            <div
              role="tablist"
              aria-label="Saved interpretations"
              className="flex flex-wrap gap-2 mb-4 justify-center"
            >
              {ordered.map((interp) => {
                const selected = interp.settings.lens === active.settings.lens;
                return (
                  <button
                    key={interp.settings.lens}
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveLens(interp.settings.lens)}
                    className={`px-4 py-2 rounded-lg border text-xs tracking-[0.1em] transition-all duration-300
                      ${selected
                        ? "border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37]"
                        : "border-[#d4af37]/20 text-[#e6d5b8]/60 hover:text-[#e6d5b8]/90 hover:border-[#d4af37]/50"}`}
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    {LENS_LABELS[interp.settings.lens]}
                    <span className={`ml-2 text-[10px] uppercase ${selected ? "text-[#d4af37]/60" : "text-[#e6d5b8]/40"}`}>
                      {INTENT_LABELS[interp.settings.intent]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="rounded-2xl border border-[#d4af37]/20 bg-gradient-to-b from-[#1a0033]/80 to-[#0a0015]/80 backdrop-blur-sm p-5 sm:p-8">
            {ordered.length === 1 && (
              <p
                className="text-center text-xs text-[#d4af37]/60 tracking-[0.2em] uppercase mb-6"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {LENS_LABELS[active.settings.lens]} · {INTENT_LABELS[active.settings.intent]}
              </p>
            )}
            <InterpretationDisplay
              question={question}
              cardInterpretations={active.card_interpretations}
              synthesis={active.synthesis}
              cardVisuals={cardVisuals}
            />
          </div>
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#e6d5b8]/30">
            <span style={{ fontFamily: "'Crimson Pro', serif" }}>
              Model: {active.model} &middot;{" "}
              {active.tokens_used.toLocaleString()} tokens
            </span>
            <button
              onClick={openModal}
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

      {modal && (
        <InterpretationModal
          readingId={readingId}
          spreadName={spreadName}
          question={question ?? undefined}
          birthDate={birthDate}
          cardVisuals={cardVisuals}
          savedInterpretations={interpretations}
          initialResult={modal.initialResult}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </>
  );
};

export default InterpretationSection;
