"use client";

import React, { useState } from "react";
import InterpretationSettingsInfo from "@/components/InterpretationSettingsInfo";
import { CONTEXT_MAX_LENGTH } from "@/lib/validation/interpret-schemas";
import { depthBandLabel, toneBandLabel } from "@/lib/interpretation-settings";
import type {
  InterpretationSettings,
  InterpretationStyle,
} from "@/types/interpret";

const STYLES: InterpretationStyle[] = [
  "practical",
  "reflective",
  "spiritual",
  "esoteric",
];

const SLIDER_MIN = 0;
const SLIDER_MAX = 100;

interface InterpretationSettingsControlsProps {
  settings: InterpretationSettings;
  context: string;
  onSettingsChange: (settings: InterpretationSettings) => void;
  onContextChange: (context: string) => void;
  disabled?: boolean;
}

const InterpretationSettingsControls: React.FC<InterpretationSettingsControlsProps> = ({
  settings,
  context,
  onSettingsChange,
  onContextChange,
  disabled,
}) => {
  const [showInfo, setShowInfo] = useState(false);

  return (
  <div className="flex flex-col gap-6">
    {/* Style */}
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span
          className="text-xs text-[#d4af37]/60 tracking-[0.2em] uppercase"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          Style
        </span>
        <button
          type="button"
          onClick={() => setShowInfo(true)}
          className="text-[10px] sm:text-xs text-[#d4af37]/50 hover:text-[#d4af37]/80 transition-colors tracking-widest select-none"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          &#9671; What do these mean? &#9671;
        </button>
      </div>
      <div
        role="group"
        aria-label="Interpretation style"
        className="grid grid-cols-2 sm:grid-cols-4 border-2 border-[#d4af37]/30 rounded-lg overflow-hidden bg-[#0a0015]/40"
      >
        {STYLES.map((style) => (
          <button
            key={style}
            type="button"
            disabled={disabled}
            aria-pressed={settings.style === style}
            onClick={() => onSettingsChange({ ...settings, style })}
            className={`py-2.5 px-2 text-center text-[11px] sm:text-xs tracking-[0.1em] uppercase transition-all duration-300
              ${settings.style === style
                ? 'bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] font-bold'
                : 'text-[#e6d5b8]/60 hover:text-[#e6d5b8]/90 hover:bg-[#d4af37]/10'}
              disabled:cursor-not-allowed`}
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {style}
          </button>
        ))}
      </div>
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
          {depthBandLabel(settings.depth)} · {settings.depth}
        </span>
      </div>
      <input
        type="range"
        min={SLIDER_MIN}
        max={SLIDER_MAX}
        value={settings.depth}
        disabled={disabled}
        onChange={(e) => onSettingsChange({ ...settings, depth: Number(e.target.value) })}
        className="w-full accent-[#d4af37] disabled:cursor-not-allowed"
        aria-label="Depth"
      />
    </div>

    {/* Tone */}
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span
          className="text-xs text-[#d4af37]/60 tracking-[0.2em] uppercase"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          Tone
        </span>
        <span
          className="text-xs text-[#e6d5b8]/70"
          style={{ fontFamily: "'Crimson Pro', serif" }}
        >
          {toneBandLabel(settings.tone)} · {settings.tone}
        </span>
      </div>
      <input
        type="range"
        min={SLIDER_MIN}
        max={SLIDER_MAX}
        value={settings.tone}
        disabled={disabled}
        onChange={(e) => onSettingsChange({ ...settings, tone: Number(e.target.value) })}
        className="w-full accent-[#d4af37] disabled:cursor-not-allowed"
        aria-label="Tone"
      />
    </div>

    {/* Context */}
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label
          htmlFor="interpretation-context"
          className="text-xs text-[#d4af37]/60 tracking-[0.2em] uppercase"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          Context
        </label>
        <span
          className="text-xs text-[#e6d5b8]/50"
          style={{ fontFamily: "'Crimson Pro', serif" }}
        >
          {context.length}/{CONTEXT_MAX_LENGTH}
        </span>
      </div>
      <textarea
        id="interpretation-context"
        rows={2}
        maxLength={CONTEXT_MAX_LENGTH}
        value={context}
        disabled={disabled}
        onChange={(e) => onContextChange(e.target.value)}
        placeholder="Anything the oracle should know about your situation (optional)"
        className="w-full border-2 border-[#d4af37]/30 rounded-lg px-3 py-2 bg-[#1a0033]/80 text-[#e6d5b8] text-sm
                   focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30 transition-all
                   placeholder:text-[#e6d5b8]/40 resize-none disabled:cursor-not-allowed"
        style={{ fontFamily: "'Crimson Pro', serif" }}
      />
    </div>

    {showInfo && <InterpretationSettingsInfo onClose={() => setShowInfo(false)} />}
  </div>
  );
};

export default InterpretationSettingsControls;
