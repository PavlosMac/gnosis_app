"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";

const STYLE_GUIDE = [
  {
    name: "Practical",
    description:
      "Grounded guidance focused on real-world situations, psychology, decisions, relationships, and personal growth.",
  },
  {
    name: "Reflective",
    description:
      "Balances practical advice with symbolic insight and psychological interpretation. The default.",
  },
  {
    name: "Spiritual",
    description:
      "Focuses on intuition, symbolism, synchronicity, and deeper personal meaning.",
  },
  {
    name: "Esoteric",
    description:
      "Fully embraces the symbolic traditions of Tarot — Kabbalah, alchemy, mythology, astrology, and numerology.",
  },
];

const DEPTH_GUIDE = [
  { name: "Brief", description: "A short reading (~150–250 words) with one primary theme and quick, actionable guidance." },
  { name: "Standard", description: "A moderate reading (~250–400 words) exploring two or three themes." },
  { name: "Detailed", description: "A rich reading (~400–700 words) with strong synthesis and connections between cards." },
  { name: "Comprehensive", description: "An extensive reading (~700–1200 words) with deep symbolic exploration." },
];

const TONE_GUIDE = [
  { name: "Gentle", description: "Compassionate and exploratory — “Consider…”, “This card invites you to…”" },
  { name: "Balanced", description: "Confident and thoughtful — “This suggests…”, “A recurring theme is…”" },
  { name: "Direct", description: "Clear and assertive — “This card points toward…”, “The challenge is…”" },
];

const GUIDE_SECTIONS = [
  { title: "Reading Style", intro: "How the cards are interpreted.", entries: STYLE_GUIDE },
  { title: "Reading Depth", intro: "How much detail is included.", entries: DEPTH_GUIDE },
  { title: "Tone", intro: "How the interpretation is written.", entries: TONE_GUIDE },
];

interface InterpretationSettingsInfoProps {
  onClose: () => void;
}

const InterpretationSettingsInfo: React.FC<InterpretationSettingsInfoProps> = ({
  onClose,
}) => {
  // Capture-phase Escape so the hosting modal's own Escape handler doesn't also fire
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[10010] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-info-title"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative max-w-lg w-full max-h-[85vh] overflow-y-auto px-6 py-8 border border-[#d4af37]/30 rounded-xl bg-[#0a0015]/95 backdrop-blur-md shadow-2xl"
        style={{ fontFamily: "'Crimson Pro', serif" }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-4 text-[#d4af37]/50 hover:text-[#d4af37] transition-colors text-xl leading-none"
          aria-label="Close"
        >
          &times;
        </button>
        <h3
          id="settings-info-title"
          className="text-center text-[#d4af37]/70 text-sm tracking-widest mb-6"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          &#9670; Attuning Your Reading &#9670;
        </h3>

        <div className="space-y-6">
          {GUIDE_SECTIONS.map((section) => (
            <div key={section.title}>
              <h4
                className="text-[#d4af37]/80 text-xs tracking-[0.2em] uppercase mb-1"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {section.title}
              </h4>
              <p className="text-[#e6d5b8]/50 text-xs italic mb-2">{section.intro}</p>
              <dl className="space-y-2">
                {section.entries.map((entry) => (
                  <div key={entry.name} className="text-sm leading-relaxed">
                    <dt className="inline text-[#d4af37]/90">{entry.name}: </dt>
                    <dd className="inline text-[#e6d5b8]/70">{entry.description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default InterpretationSettingsInfo;
