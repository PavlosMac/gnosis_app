"use client";

import React from "react";
import {
  LENSES,
  INTENTS,
  LENS_LABELS,
  INTENT_LABELS,
  estimatedWordsPerCard,
} from "@/lib/interpretation-defaults";
import type {
  InterpretationSettings,
  InterpretationLens,
  InterpretationIntent,
} from "@/types/interpret";

const LENS_META: Record<InterpretationLens, { description: string; icon: React.ReactNode }> = {
  traditional: {
    description: "Conventional meanings, read plainly.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M12 5c-2-1.5-5-2-8-2v16c3 0 6 .5 8 2 2-1.5 5-2 8-2V3c-3 0-6 .5-8 2z" />
        <path d="M12 5v16" />
      </svg>
    ),
  },
  psychological: {
    description: "Inner patterns and what they defend.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  esoteric: {
    description: "Sign, planet, path and number.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2l2.4 7.2H22l-6.2 4.5 2.4 7.3-6.2-4.5-6.2 4.5 2.4-7.3L2 9.2h7.6z" />
      </svg>
    ),
  },
  alchemical: {
    description: "What is dissolving, joining, fixing.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 3h4M11 3v6l-6 11a1 1 0 001 1h12a1 1 0 001-1L13 9V3" />
        <path d="M8 15h8" />
      </svg>
    ),
  },
};

const INTENT_DESCRIPTIONS: Record<InterpretationIntent, string> = {
  reflective: "What is present, rather than what will happen.",
  predictive: "What is likely to unfold.",
};

interface InterpretationSettingsControlsProps {
  settings: InterpretationSettings;
  onSettingsChange: (settings: InterpretationSettings) => void;
  cardCount: number;
  savedLenses?: InterpretationLens[];
  disabled?: boolean;
}

const InterpretationSettingsControls: React.FC<InterpretationSettingsControlsProps> = ({
  settings,
  onSettingsChange,
  cardCount,
  savedLenses = [],
  disabled,
}) => (
  <div className="flex flex-col gap-6">
    <p
      className="text-xs text-[#e6d5b8]/40 text-center"
      style={{ fontFamily: "'Crimson Pro', serif" }}
    >
      Applies to every reading until you change it.
    </p>

    {/* Primary lens */}
    <div>
      <span
        className="block text-xs text-[#d4af37]/60 tracking-[0.2em] uppercase mb-2"
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        Primary Lens
      </span>
      <div role="radiogroup" aria-label="Primary lens" className="flex flex-col gap-2">
        {LENSES.map((lens) => {
          const meta = LENS_META[lens];
          const selected = settings.lens === lens;
          return (
            <button
              key={lens}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onSettingsChange({ ...settings, lens })}
              className={`flex items-center gap-3 sm:gap-4 px-4 py-3 rounded-lg border-2 text-left transition-all duration-300
                ${selected
                  ? "border-[#d4af37] bg-[#d4af37]/10"
                  : "border-[#d4af37]/20 bg-[#0a0015]/40 hover:border-[#d4af37]/50"}
                disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <span className={selected ? "text-[#d4af37]" : "text-[#e6d5b8]/50"}>
                {meta.icon}
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-baseline gap-2">
                  <span
                    className={`text-sm tracking-[0.1em] ${selected ? "text-[#d4af37]" : "text-[#e6d5b8]/80"}`}
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    {LENS_LABELS[lens]}
                  </span>
                  {savedLenses.includes(lens) && (
                    <span
                      className="text-[10px] text-[#e6d5b8]/40 tracking-wider uppercase"
                      style={{ fontFamily: "'Cinzel', serif" }}
                    >
                      will replace
                    </span>
                  )}
                </span>
                <span
                  className="block text-xs text-[#e6d5b8]/50 mt-0.5"
                  style={{ fontFamily: "'Crimson Pro', serif" }}
                >
                  {meta.description}
                </span>
              </span>
              {selected && <span className="text-[#d4af37] shrink-0">✓</span>}
            </button>
          );
        })}
      </div>
    </div>

    {/* Intent */}
    <div>
      <span
        className="block text-xs text-[#d4af37]/60 tracking-[0.2em] uppercase mb-2"
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        Intent
      </span>
      <div
        role="radiogroup"
        aria-label="Intent"
        className="grid grid-cols-2 border-2 border-[#d4af37]/30 rounded-lg overflow-hidden bg-[#0a0015]/40"
      >
        {INTENTS.map((intent) => {
          const selected = settings.intent === intent;
          return (
            <button
              key={intent}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onSettingsChange({ ...settings, intent })}
              className={`py-2.5 px-2 text-center text-xs tracking-[0.1em] uppercase transition-all duration-300
                ${selected
                  ? "bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] font-bold"
                  : "text-[#e6d5b8]/60 hover:text-[#e6d5b8]/90 hover:bg-[#d4af37]/10"}
                disabled:cursor-not-allowed`}
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              {INTENT_LABELS[intent]}
            </button>
          );
        })}
      </div>
      <p
        className="text-xs text-[#e6d5b8]/50 mt-1.5"
        style={{ fontFamily: "'Crimson Pro', serif" }}
      >
        {INTENT_DESCRIPTIONS[settings.intent]}
      </p>
    </div>

    {/* Depth */}
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span
          className="text-xs text-[#d4af37]/60 tracking-[0.2em] uppercase"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          Depth
        </span>
        <span
          className="text-xs text-[#e6d5b8]/70"
          style={{ fontFamily: "'Crimson Pro', serif" }}
        >
          {settings.depth}%
          {cardCount > 0 &&
            ` · ≈${estimatedWordsPerCard(settings.depth, cardCount)} words per card`}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={settings.depth}
        disabled={disabled}
        onChange={(e) => onSettingsChange({ ...settings, depth: Number(e.target.value) })}
        className="w-full accent-[#d4af37] disabled:cursor-not-allowed"
        aria-label="Depth"
      />
    </div>
  </div>
);

export default InterpretationSettingsControls;
