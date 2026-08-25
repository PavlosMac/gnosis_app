"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import OrnateFrame from "@/components/OrnateFrame";
import InterpretationSettingsControls from "@/components/InterpretationSettingsControls";
import type { InterpretationSettings } from "@/types/interpret";

interface ReadingStyleModalProps {
  settings: InterpretationSettings;
  onSettingsChange: (settings: InterpretationSettings) => void;
  cardCount: number;
  onClose: () => void;
}

const ReadingStyleModal: React.FC<ReadingStyleModalProps> = ({
  settings,
  onSettingsChange,
  cardCount,
  onClose,
}) => {
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

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center isolate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reading-style-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm z-0"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div
        className="relative z-10 w-full mx-4 my-8 max-w-2xl max-h-[calc(100vh-4rem)] overflow-y-auto rounded-xl border-2 border-[#d4af37]/40 shadow-2xl"
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
            id="reading-style-title"
            className="text-xl sm:text-2xl font-bold text-[#d4af37] tracking-wider"
            style={{
              fontFamily: "'Cinzel', serif",
              textShadow: "0 0 15px rgba(212,175,55,0.4)",
            }}
          >
            ✦ Reading Style ✦
          </h2>
          <button
            onClick={onClose}
            className="shrink-0 text-[#d4af37]/60 hover:text-[#d4af37] transition-colors text-2xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-8">
          <InterpretationSettingsControls
            settings={settings}
            onSettingsChange={onSettingsChange}
            cardCount={cardCount}
          />

          <div className="flex justify-center">
            <button
              onClick={onClose}
              className="px-10 py-3 bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] rounded-lg
                         font-bold shadow-lg hover:shadow-[#d4af37]/50 transition-all text-sm"
              style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.1em" }}
            >
              ✦ Done ✦
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ReadingStyleModal;
