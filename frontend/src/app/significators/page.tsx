"use client";
import { useState } from "react";
import TarotPageLayout from "@/components/TarotPageLayout";
import SignificatorsLayout from "@/components/SignificatorsLayout";
import { calculateSignificators, SignificatorResult } from "@/lib/significators";
import { parseAndValidateDate } from "@/lib/dateValidation";
  
export default function SignificatorsPage() {
  const [day, setDay] = useState<string>("");
  const [month, setMonth] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [result, setResult] = useState<SignificatorResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = () => {
    const { dateParts, validation } = parseAndValidateDate(day, month, year);

    if (!validation.isValid) {
      setError(validation.error || "Invalid date");
      setResult(null);
      return;
    }

    if (!dateParts) {
      setError("Please enter a valid date");
      setResult(null);
      return;
    }

    setError(null);
    const significators = calculateSignificators(
      dateParts.year,
      dateParts.month,
      dateParts.day
    );
    setResult(significators);
  };

  const hasValidInput = () => {
    const { validation } = parseAndValidateDate(day, month, year);
    return validation.isValid;
  };

  return (
    <TarotPageLayout>
      <div className="w-full max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#d4af37] tracking-wider mb-4"
            style={{
              fontFamily: "'Cinzel', serif",
              textShadow: "0 0 30px rgba(212,175,55,0.4)",
            }}
          >
            Significators
          </h1>
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="w-24 h-px bg-gradient-to-r from-transparent via-[#d4af37]/60 to-[#d4af37]" />
            <span className="text-[#d4af37] text-xl">⚝</span>
            <div className="w-24 h-px bg-gradient-to-l from-transparent via-[#d4af37]/60 to-[#d4af37]" />
          </div>
          <p
            className="text-[#e6d5b8]/70 text-lg sm:text-xl mt-6 max-w-2xl mx-auto leading-relaxed"
            style={{ fontFamily: "'Crimson Pro', serif" }}
          >
            Discover your personal tarot significators based on your birth
            date. These cards reveal your character, destiny, and life cycles.
          </p>
        </div>

        {/* Date Input */}
        <div className="flex flex-col items-center gap-6 mb-12">
          <label
            className="text-lg text-[#e6d5b8] tracking-wide"
            style={{ fontFamily: "'Crimson Pro', serif" }}
          >
            Enter your birth date
          </label>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex flex-col items-center">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                placeholder="DD"
                value={day}
                onChange={(e) => {
                  setDay(e.target.value.replace(/\D/g, "").slice(0, 2));
                  setError(null);
                }}
                className="border-2 border-[#d4af37]/50 rounded-lg px-3 py-3 bg-[#1a0033]/80 text-[#e6d5b8] text-lg text-center backdrop-blur-sm
                           focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30 transition-all
                           w-16"
                style={{ fontFamily: "'Crimson Pro', serif" }}
              />
              <span className="text-xs text-[#d4af37]/50 mt-1" style={{ fontFamily: "'Cinzel', serif" }}>Day</span>
            </div>
            <span className="text-[#d4af37]/60 text-2xl">/</span>
            <div className="flex flex-col items-center">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                placeholder="MM"
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value.replace(/\D/g, "").slice(0, 2));
                  setError(null);
                }}
                className="border-2 border-[#d4af37]/50 rounded-lg px-3 py-3 bg-[#1a0033]/80 text-[#e6d5b8] text-lg text-center backdrop-blur-sm
                           focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30 transition-all
                           w-16"
                style={{ fontFamily: "'Crimson Pro', serif" }}
              />
              <span className="text-xs text-[#d4af37]/50 mt-1" style={{ fontFamily: "'Cinzel', serif" }}>Month</span>
            </div>
            <span className="text-[#d4af37]/60 text-2xl">/</span>
            <div className="flex flex-col items-center">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="YYYY"
                value={year}
                onChange={(e) => {
                  setYear(e.target.value.replace(/\D/g, "").slice(0, 4));
                  setError(null);
                }}
                className="border-2 border-[#d4af37]/50 rounded-lg px-3 py-3 bg-[#1a0033]/80 text-[#e6d5b8] text-lg text-center backdrop-blur-sm
                           focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30 transition-all
                           w-24"
                style={{ fontFamily: "'Crimson Pro', serif" }}
              />
              <span className="text-xs text-[#d4af37]/50 mt-1" style={{ fontFamily: "'Cinzel', serif" }}>Year</span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-red-400 text-sm" style={{ fontFamily: "'Crimson Pro', serif" }}>
              {error}
            </p>
          )}

          <button
            onClick={handleGenerate}
            disabled={!hasValidInput()}
            className="px-8 py-3 bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] rounded-lg
                       shadow-lg hover:shadow-[#d4af37]/50 transition-all duration-300 font-bold text-lg
                       hover:scale-105 active:scale-95 border border-[#d4af37]/50
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.1em" }}
          >
            Generate Significators
          </button>
        </div>

        {/* Results */}
        {result && (
          <div className="animate-fadeIn">
            <SignificatorsLayout significatorResult={result} />
          </div>
        )}

        {/* Footer decoration */}
        <div className="mt-16 text-center">
          <div className="flex items-center justify-center gap-3">
            <span className="text-[#d4af37]/40">✦</span>
            <span className="text-[#d4af37]/30">✦</span>
            <span className="text-[#d4af37]/40">☥</span>
            <span className="text-[#d4af37]/30">✦</span>
            <span className="text-[#d4af37]/40">✦</span>
          </div>
        </div>
      </div>
    </TarotPageLayout>
  );
}
