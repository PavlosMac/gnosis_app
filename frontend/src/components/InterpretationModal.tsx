"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import OrnateFrame from "@/components/OrnateFrame";
import InterpretationDisplay from "@/components/InterpretationDisplay";
import {
  generateInterpretation,
  saveInterpretation,
} from "@/app/user/interpret/actions";
import { writeInterpretationBackup } from "@/lib/interpretation-backup";
import type { TarotCardData } from "@/types/models";
import type { Interpretation } from "@/types/interpret";

type ModalState = "generating" | "preview" | "saving" | "error";

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Format a "YYYY-MM-DD" birthdate as "12 Mar 1990" (matches readings list style)
const formatBirthDate = (iso: string): string => {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${SHORT_MONTHS[month - 1]} ${year}`;
};

interface InterpretationModalProps {
  readingId: string;
  spreadName: string;
  question?: string;
  birthDate?: string;
  cardVisuals: Record<string, { card: TarotCardData; reversed: boolean } | null>;
  savedInterpretation?: Interpretation | null;
  onClose: () => void;
  onSaved: () => void;
}

const InterpretationModal: React.FC<InterpretationModalProps> = React.memo(({
  readingId,
  spreadName,
  question,
  birthDate,
  cardVisuals,
  savedInterpretation,
  onClose,
  onSaved,
}) => {
  const [modalState, setModalState] = useState<ModalState>("generating");
  const [unsavedResult, setUnsavedResult] = useState<Interpretation | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const isFetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);

  const requestClose = useCallback(() => {
    if (unsavedResult) {
      setShowCloseConfirm(true);
      return;
    }
    onClose();
  }, [unsavedResult, onClose]);

  // Lock body scroll and handle Escape key
  useEffect(() => {
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [requestClose]);

  const generate = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setModalState("generating");
    setSaveError("");
    try {
      const result = await generateInterpretation(readingId);
      if (result.ok) {
        setUnsavedResult(result.data);
        setModalState("preview");
      } else {
        setErrorMessage(result.error);
        setModalState("error");
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [readingId]);

  // Fire once on mount
  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      generate();
    }
  }, [generate]);

  const handleSave = useCallback(async () => {
    if (!unsavedResult) return;
    setModalState("saving");
    setSaveError("");
    const replaced = savedInterpretation ?? null;
    const result = await saveInterpretation(readingId, unsavedResult);
    if (!result.ok) {
      setSaveError(result.error);
      setModalState("preview");
      return;
    }
    if (replaced) writeInterpretationBackup(readingId, replaced);
    setUnsavedResult(null);
    onSaved();
    onClose();
  }, [unsavedResult, savedInterpretation, readingId, onSaved, onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center isolate"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm z-0"
        onClick={requestClose}
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
          <div className="flex flex-col gap-1 min-w-0">
            <h2
              className="text-xl sm:text-2xl font-bold text-[#d4af37] tracking-wider"
              style={{
                fontFamily: "'Cinzel', serif",
                textShadow: "0 0 15px rgba(212,175,55,0.4)",
              }}
            >
              ✦ Interpretation ✦
            </h2>
            <p
              className="text-xs sm:text-sm text-[#d4af37]/70 tracking-wide truncate"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              {spreadName}
              {birthDate && ` · ${formatBirthDate(birthDate)}`}
            </p>
          </div>
          <button
            onClick={requestClose}
            className="shrink-0 text-[#d4af37]/60 hover:text-[#d4af37] transition-colors text-2xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* GENERATING STATE */}
          {modalState === "generating" && (
            <div className="flex flex-col items-center gap-6 py-16">
              <div className="w-16 h-16 border-4 border-[#d4af37]/20 border-t-[#d4af37] rounded-full animate-spin" />
              <p
                className="text-[#d4af37]/80 text-lg tracking-wider"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                The Oracle consults the stars...
              </p>
            </div>
          )}

          {/* ERROR STATE (generate failed) */}
          {modalState === "error" && (
            <div className="flex flex-col items-center gap-6 py-8">
              <p
                className="text-red-400 text-center text-base"
                style={{ fontFamily: "'Crimson Pro', serif" }}
              >
                {errorMessage || "The oracle could not be reached."}
              </p>
              <button
                onClick={generate}
                className="px-8 py-3 border border-[#d4af37]/40 text-[#d4af37] hover:bg-[#d4af37]/10 rounded-lg transition-all text-sm"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* PREVIEW / SAVING STATE */}
          {(modalState === "preview" || modalState === "saving") && unsavedResult && (
            <div className="flex flex-col gap-8">
              <InterpretationDisplay
                question={question}
                cardInterpretations={unsavedResult.card_interpretations}
                synthesis={unsavedResult.synthesis}
                cardVisuals={cardVisuals}
              />

              {saveError && (
                <p
                  className="text-red-400 text-center text-sm"
                  style={{ fontFamily: "'Crimson Pro', serif" }}
                >
                  {saveError}
                </p>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={handleSave}
                  disabled={modalState === "saving"}
                  className="px-10 py-3 bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] rounded-lg
                             font-bold shadow-lg hover:shadow-[#d4af37]/50 transition-all
                             disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                  style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.1em" }}
                >
                  {modalState === "saving" ? "Saving..." : "✦ Save Interpretation ✦"}
                </button>
                <button
                  onClick={generate}
                  disabled={modalState === "saving"}
                  className="px-8 py-3 border border-[#d4af37]/30 text-[#d4af37]/70 hover:text-[#d4af37]
                             hover:border-[#d4af37]/60 rounded-lg transition-all text-sm
                             disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  Regenerate
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Unsaved-close confirmation */}
        {showCloseConfirm && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70">
            <div
              className="mx-6 p-6 rounded-xl border-2 border-[#d4af37]/40 text-center"
              style={{
                background:
                  "linear-gradient(135deg, rgba(26,0,51,0.98) 0%, rgba(45,27,78,0.98) 100%)",
              }}
            >
              <p
                className="text-[#e6d5b8]/90 mb-6"
                style={{ fontFamily: "'Crimson Pro', serif" }}
              >
                Save this interpretation before leaving?
              </p>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => {
                    setShowCloseConfirm(false);
                    handleSave();
                  }}
                  className="px-8 py-2.5 bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033]
                             rounded-lg font-bold text-sm"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  Save
                </button>
                <button
                  onClick={onClose}
                  className="px-8 py-2.5 border border-[#d4af37]/30 text-[#d4af37]/70
                             hover:text-[#d4af37] rounded-lg text-sm"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
});

InterpretationModal.displayName = "InterpretationModal";

export default InterpretationModal;
