"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import OrnateFrame from "@/components/OrnateFrame";
import InterpretationDisplay from "@/components/InterpretationDisplay";
import InterpretationSettingsControls from "@/components/InterpretationSettingsControls";
import {
  generateInterpretation,
  saveInterpretation,
} from "@/app/user/interpret/actions";
import {
  readDefaultSettings,
  writeDefaultSettings,
  settingsEqual,
  LENS_LABELS,
  INTENT_LABELS,
} from "@/lib/interpretation-defaults";
import { stashUnsavedInterpretation, loginToSaveHref } from "@/lib/interpretation-stash";
import type { TarotCardData } from "@/types/models";
import type { Interpretation, InterpretationSettings } from "@/types/interpret";

type ModalState = "tweak" | "generating" | "preview" | "saving" | "error";

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Format a "YYYY-MM-DD" birthdate as "12 Mar 1990" (matches readings list style)
const formatBirthDate = (iso: string): string => {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${SHORT_MONTHS[month - 1]} ${year}`;
};

const settingsCaption = (settings: InterpretationSettings): string =>
  `${LENS_LABELS[settings.lens]} · ${INTENT_LABELS[settings.intent]}`;

const CINZEL = { fontFamily: "'Cinzel', serif" } as const;
const GOLD_BUTTON = "bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] rounded-lg font-bold";
const OUTLINE_BUTTON = "border border-[#d4af37]/30 text-[#d4af37]/70 hover:text-[#d4af37] rounded-lg";

interface ConfirmOverlayProps {
  message: string;
  primary: React.ReactNode;
  secondaryLabel: string;
  onSecondary: () => void;
}

// In-modal confirmation panel; the primary control is passed in so it can be a
// button or a login link
const ConfirmOverlay: React.FC<ConfirmOverlayProps> = ({
  message,
  primary,
  secondaryLabel,
  onSecondary,
}) => (
  <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70">
    <div
      className="mx-6 p-6 rounded-xl border-2 border-[#d4af37]/40 text-center"
      style={{
        background:
          "linear-gradient(135deg, rgba(26,0,51,0.98) 0%, rgba(45,27,78,0.98) 100%)",
      }}
    >
      <p className="text-[#e6d5b8]/90 mb-6" style={{ fontFamily: "'Crimson Pro', serif" }}>
        {message}
      </p>
      <div className="flex items-center justify-center gap-4">
        {primary}
        <button
          onClick={onSecondary}
          className={`px-8 py-2.5 text-sm ${OUTLINE_BUTTON}`}
          style={CINZEL}
        >
          {secondaryLabel}
        </button>
      </div>
    </div>
  </div>
);

interface InterpretationModalProps {
  readingId: string;
  spreadName: string;
  question?: string;
  birthDate?: string;
  cardVisuals: Record<string, { card: TarotCardData; reversed: boolean } | null>;
  savedInterpretations: Interpretation[];
  onClose: () => void;
  // interpretations: the reading's full saved list returned by the backend
  onSaved: (saved: Interpretation, interpretations: Interpretation[]) => void;
  initialSettings?: InterpretationSettings;
  autoGenerate?: boolean;
  // Open directly in preview with an unsaved result (restored after a login round-trip)
  initialResult?: Interpretation;
}

const InterpretationModal: React.FC<InterpretationModalProps> = React.memo(({
  readingId,
  spreadName,
  question,
  birthDate,
  cardVisuals,
  savedInterpretations,
  onClose,
  onSaved,
  initialSettings,
  autoGenerate = false,
  initialResult,
}) => {
  const [modalState, setModalState] = useState<ModalState>(
    initialResult ? "preview" : autoGenerate ? "generating" : "tweak"
  );
  const [unsavedResult, setUnsavedResult] = useState<Interpretation | null>(
    initialResult ?? null
  );
  const [tunedSettings, setTunedSettings] = useState<InterpretationSettings>(
    () => initialResult?.settings ?? initialSettings ?? readDefaultSettings()
  );
  const [lastGenerated, setLastGenerated] = useState<InterpretationSettings | null>(
    initialResult?.settings ?? null
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  // Set when a request came back unauthenticated: retrying cannot succeed, so
  // the UI offers a login round-trip (stashing the unsaved result) instead
  const [sessionExpired, setSessionExpired] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);

  const isFetchingRef = useRef(false);

  const cardCount = Object.keys(cardVisuals).length;
  const savedLenses = savedInterpretations.map((i) => i.settings.lens);
  const replacedInterpretation = unsavedResult
    ? savedInterpretations.find((i) => i.settings.lens === unsavedResult.settings.lens) ?? null
    : null;

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

  const runGenerate = useCallback(
    async (settings: InterpretationSettings) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      setModalState("generating");
      setSaveError("");
      try {
        const result = await generateInterpretation(readingId, settings);
        if (result.ok) {
          setUnsavedResult(result.data);
          setTunedSettings(result.data.settings);
          setLastGenerated(result.data.settings);
          setModalState("preview");
        } else {
          setErrorMessage(result.error);
          if (result.unauthenticated) setSessionExpired(true);
          setModalState("error");
        }
      } catch {
        setErrorMessage("The oracle could not be reached.");
        setModalState("error");
      } finally {
        isFetchingRef.current = false;
      }
    },
    [readingId]
  );

  const generateTuned = useCallback(() => {
    runGenerate(tunedSettings);
  }, [runGenerate, tunedSettings]);

  // When opened with autoGenerate, start generating immediately — once, even
  // though generateTuned changes identity after the first result
  const autoGeneratedRef = useRef(false);
  useEffect(() => {
    if (!autoGenerate || autoGeneratedRef.current) return;
    autoGeneratedRef.current = true;
    generateTuned();
  }, [autoGenerate, generateTuned]);

  const performSave = useCallback(async () => {
    if (!unsavedResult) return;
    setModalState("saving");
    setSaveError("");
    let result;
    try {
      result = await saveInterpretation(readingId, unsavedResult);
    } catch {
      setSaveError("The interpretation could not be saved.");
      setModalState("preview");
      return;
    }
    if (!result.ok) {
      setSaveError(result.error);
      if (result.unauthenticated) setSessionExpired(true);
      setModalState("preview");
      return;
    }
    writeDefaultSettings(unsavedResult.settings);
    setUnsavedResult(null);
    onSaved(unsavedResult, result.interpretations);
    onClose();
  }, [unsavedResult, readingId, onSaved, onClose]);

  // Keep the unsaved result across the login round-trip; the reading detail
  // page reopens this modal in preview from the stash once the user is back
  const stashForLogin = useCallback(() => {
    if (unsavedResult) stashUnsavedInterpretation(readingId, unsavedResult);
  }, [readingId, unsavedResult]);

  const loginHref = loginToSaveHref(readingId);

  // Once the session is gone every primary action becomes "log in" (stashing
  // the unsaved result); otherwise it is the ordinary button
  const primaryAction = (
    label: React.ReactNode,
    loginLabel: string,
    onClick: () => void,
    className: string,
    disabled = false
  ) =>
    sessionExpired ? (
      <Link href={loginHref} onClick={stashForLogin} className={className} style={CINZEL}>
        {loginLabel}
      </Link>
    ) : (
      <button onClick={onClick} disabled={disabled} className={className} style={CINZEL}>
        {label}
      </button>
    );

  // Save, asking first when this lens slot already holds a saved interpretation
  const handleSaveRequest = useCallback(() => {
    if (replacedInterpretation) {
      setShowReplaceConfirm(true);
      return;
    }
    performSave();
  }, [replacedInterpretation, performSave]);

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
              {primaryAction(
                "Try Again",
                "Log In",
                generateTuned,
                "px-8 py-3 border border-[#d4af37]/40 text-[#d4af37] hover:bg-[#d4af37]/10 rounded-lg transition-all text-sm"
              )}
            </div>
          )}

          {/* PREVIEW / SAVING STATE */}
          {(modalState === "preview" || modalState === "saving") && unsavedResult && (
            <div className="flex flex-col gap-8">
              <p
                className="text-center text-xs text-[#d4af37]/60 tracking-[0.2em] uppercase"
                style={CINZEL}
              >
                {settingsCaption(unsavedResult.settings)}
              </p>

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
                {primaryAction(
                  modalState === "saving" ? "Saving..." : "✦ Save Interpretation ✦",
                  "✦ Log In to Save ✦",
                  handleSaveRequest,
                  `px-10 py-3 ${GOLD_BUTTON} shadow-lg hover:shadow-[#d4af37]/50 transition-all
                   disabled:opacity-60 disabled:cursor-not-allowed text-sm tracking-[0.1em]`,
                  modalState === "saving"
                )}
                <button
                  onClick={() => setModalState("tweak")}
                  disabled={modalState === "saving"}
                  className="px-8 py-3 border border-[#d4af37]/30 text-[#d4af37]/70 hover:text-[#d4af37]
                             hover:border-[#d4af37]/60 rounded-lg transition-all text-sm
                             disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  Tune &amp; Regenerate
                </button>
              </div>
            </div>
          )}

          {/* TWEAK STATE */}
          {modalState === "tweak" && (
            <div className="flex flex-col gap-8">
              <InterpretationSettingsControls
                settings={tunedSettings}
                onSettingsChange={setTunedSettings}
                cardCount={cardCount}
                savedLenses={savedLenses}
              />

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={generateTuned}
                  disabled={
                    lastGenerated !== null && settingsEqual(tunedSettings, lastGenerated)
                  }
                  className="px-10 py-3 bg-gradient-to-br from-[#8a2be2]/80 to-[#5a1a9e]/80 text-[#e6d5b8] rounded-lg
                             font-bold shadow-lg hover:shadow-[#8a2be2]/40 transition-all text-sm border border-[#8a2be2]/40
                             disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
                  style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.1em" }}
                >
                  {unsavedResult ? "✦ Regenerate ✦" : "✦ Consult the Oracle ✦"}
                </button>
                {unsavedResult && (
                  <button
                    onClick={() => setModalState("preview")}
                    className="px-8 py-3 border border-[#d4af37]/30 text-[#d4af37]/70 hover:text-[#d4af37]
                               hover:border-[#d4af37]/60 rounded-lg transition-all text-sm"
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    Back to preview
                  </button>
                )}
              </div>

              {unsavedResult && (
                <p
                  className="text-center text-xs text-[#e6d5b8]/40"
                  style={{ fontFamily: "'Crimson Pro', serif" }}
                >
                  Adjust the lens, intent, or depth to regenerate.
                </p>
              )}
            </div>
          )}
        </div>

        {showReplaceConfirm && unsavedResult && replacedInterpretation && (
          <ConfirmOverlay
            message={
              replacedInterpretation.settings.intent !== unsavedResult.settings.intent
                ? `Replace your saved ${LENS_LABELS[unsavedResult.settings.lens]} interpretation
                   (${INTENT_LABELS[replacedInterpretation.settings.intent]}) with this
                   ${INTENT_LABELS[unsavedResult.settings.intent]} one?`
                : `Replace your saved ${LENS_LABELS[unsavedResult.settings.lens]} interpretation?`
            }
            primary={
              <button
                onClick={() => {
                  setShowReplaceConfirm(false);
                  performSave();
                }}
                className={`px-8 py-2.5 text-sm ${GOLD_BUTTON}`}
                style={CINZEL}
              >
                Replace
              </button>
            }
            secondaryLabel="Cancel"
            onSecondary={() => setShowReplaceConfirm(false)}
          />
        )}

        {showCloseConfirm && (
          <ConfirmOverlay
            message={
              sessionExpired
                ? "Your session has expired. Log in to keep this interpretation, or leave and lose it."
                : "Save this interpretation before leaving?"
            }
            primary={primaryAction(
              "Save",
              "Log In",
              () => {
                setShowCloseConfirm(false);
                handleSaveRequest();
              },
              `px-8 py-2.5 text-sm ${GOLD_BUTTON}`
            )}
            secondaryLabel={sessionExpired ? "Leave" : "Discard"}
            onSecondary={onClose}
          />
        )}
      </div>
    </div>,
    document.body
  );
});

InterpretationModal.displayName = "InterpretationModal";

export default InterpretationModal;
