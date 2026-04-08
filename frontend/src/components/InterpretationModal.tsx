"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import OrnateFrame from "@/components/OrnateFrame";
import InterpretationDisplay from "@/components/InterpretationDisplay";
import { getInterpretation } from "@/app/user/interpret/actions";
import type { ReadingResult } from "@/types/reading";
import type { InterpretResult, InterpretResponse } from "@/types/interpret";

type ModalState = "loading" | "result" | "error";

interface InterpretationModalProps {
  reading: ReadingResult;
  onClose: () => void;
  initialResult: InterpretResult | null;
  onResultReceived: (r: InterpretResult) => void;
}

export default function InterpretationModal({
  reading,
  onClose,
  initialResult,
  onResultReceived,
}: InterpretationModalProps) {
  const getInitialState = (): ModalState => {
    if (!initialResult) return "loading";
    return initialResult.ok ? "result" : "error";
  };

  const [modalState, setModalState] = useState<ModalState>(getInitialState);
  const [result, setResult] = useState<InterpretResponse | null>(
    initialResult?.ok ? initialResult.data : null
  );
  const [errorMessage, setErrorMessage] = useState(
    !initialResult?.ok ? (initialResult?.error ?? "") : ""
  );

  // Lock body scroll and handle Escape key
  useEffect(() => {
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const isFetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);

  const fetchInterpretation = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const cards = Object.entries(reading.positions).map(([position, card]) => ({
        name: card.name,
        position,
        orientation: card.reversed ? ("reversed" as const) : ("upright" as const),
        ...(reading.positionDescriptions?.[position] && {
          position_description: reading.positionDescriptions[position],
        }),
      }));

      const payload = {
        spread_name: reading.readingType,
        ...(reading.question && reading.question.trim().length >= 5 && {
          question: reading.question,
        }),
        cards,
      };

      if (process.env.NODE_ENV === "development")
        console.log("[INTERPRET:CLIENT] Payload:", JSON.stringify(payload, null, 2));
      const interpretResult = await getInterpretation(payload);

      onResultReceived(interpretResult);

      if (interpretResult.ok) {
        setResult(interpretResult.data);
        setModalState("result");
      } else {
        setErrorMessage(interpretResult.error);
        setModalState("error");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "The oracle could not be reached.";
      setErrorMessage(message);
      setModalState("error");
      onResultReceived({ ok: false, error: message });
    } finally {
      isFetchingRef.current = false;
    }
  }, [reading, onResultReceived]);

  // Fire once on mount if no cached result
  useEffect(() => {
    if (!initialResult && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchInterpretation();
    }
  }, [fetchInterpretation]);

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div
        className="relative z-10 w-full mx-4 my-8 max-w-3xl max-h-[calc(100vh-4rem)] overflow-y-auto rounded-xl border-2 border-[#d4af37]/40 shadow-2xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(26,0,51,0.97) 0%, rgba(45,27,78,0.97) 100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ornate corner decorations */}
        <OrnateFrame size="sm" corners="top" />

        {/* Sticky header */}
        <div
          className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-[#d4af37]/20"
          style={{
            background:
              "linear-gradient(135deg, rgba(26,0,51,0.98) 0%, rgba(45,27,78,0.98) 100%)",
          }}
        >
          <h2
            className="text-xl sm:text-2xl font-bold text-[#d4af37] tracking-wider"
            style={{
              fontFamily: "'Cinzel', serif",
              textShadow: "0 0 15px rgba(212,175,55,0.4)",
            }}
          >
            ✦ Oracle Interpretation ✦
          </h2>
          <button
            onClick={onClose}
            className="text-[#d4af37]/60 hover:text-[#d4af37] transition-colors text-2xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* LOADING STATE */}
          {modalState === "loading" && (
            <div className="flex flex-col items-center gap-6 py-16">
              <div
                className="w-16 h-16 border-4 border-[#d4af37]/20 border-t-[#d4af37] rounded-full animate-spin"
              />
              <p
                className="text-[#d4af37]/80 text-lg tracking-wider"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                The Oracle consults the stars...
              </p>
            </div>
          )}

          {/* ERROR STATE */}
          {modalState === "error" && (
            <div className="flex flex-col items-center gap-6 py-8">
              <p
                className="text-red-400 text-center text-base"
                style={{ fontFamily: "'Crimson Pro', serif" }}
              >
                {errorMessage || "The oracle could not be reached."}
              </p>
              <button
                onClick={() => { setModalState("loading"); fetchInterpretation(); }}
                className="px-8 py-3 border border-[#d4af37]/40 text-[#d4af37] hover:bg-[#d4af37]/10 rounded-lg transition-all text-sm"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* RESULT STATE */}
          {modalState === "result" && result && (
            <div className="flex flex-col gap-8">
              <InterpretationDisplay
                question={reading.question}
                cardInterpretations={result.card_interpretations}
                synthesis={result.synthesis}
                cardVisuals={Object.fromEntries(
                  Object.entries(reading.positions).map(([pos, card]) => [
                    pos,
                    { card, reversed: card.reversed },
                  ])
                )}
              />

              <button
                onClick={onClose}
                className="self-center px-10 py-3 border border-[#d4af37]/30 text-[#d4af37]/70 hover:text-[#d4af37]
                           hover:border-[#d4af37]/60 rounded-lg transition-all text-sm"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
