"use client";
import { useState } from "react";
import TarotCard from "@/app/components/TarotCard";
import TarotPageLayout from "@/app/components/TarotPageLayout";
import SignificatorSection from "@/app/components/SignificatorSection";
import { calculateSignificators, SignificatorResult } from "@/app/utils/significators";
import { parseAndValidateDate } from "@/app/utils/dateValidation";

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
            {/* Divider */}
            <div className="flex items-center justify-center gap-6 my-10">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#d4af37]/30" />
              <span className="text-[#d4af37]/60 text-lg">✦</span>
              <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#d4af37]/30" />
            </div>

            <div className="text-center mb-8">
              <h2
                className="text-2xl sm:text-3xl text-[#d4af37] tracking-wider"
                style={{
                  fontFamily: "'Cinzel', serif",
                  textShadow: "0 0 20px rgba(212,175,55,0.3)",
                }}
              >
                Your Personal Significators
              </h2>
            </div>

            {/* Day Number & Astrological Sign - 2 column grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              {/* Day Number */}
              <SignificatorSection
                title="Day Number"
                symbol="☾"
                description={`Your day number is ${result.dayNumber.number}, representing the day you were born.`}
              >
                <div className="flex justify-center">
                  <div className="flex flex-col items-center">
                    <TarotCard
                      card={result.dayNumber.card}
                      small={false}
                      showMeaning={true}
                    />
                  </div>
                </div>
              </SignificatorSection>

              {/* Astrological Sign */}
              {result.zodiacSign && (
                <SignificatorSection
                  title="Astrological Sign"
                  symbol="☉"
                  description={`Your sun sign is ${result.zodiacSign.sign}, connected to this Major Arcana.`}
                >
                  <div className="flex justify-center">
                    <div className="flex flex-col items-center">
                      <TarotCard
                        card={result.zodiacSign.card}
                        small={false}
                        showMeaning={true}
                      />
                    </div>
                  </div>
                </SignificatorSection>
              )}
            </div>

            {/* Life Number - Full width */}
            <div className="mb-12">
              <SignificatorSection
                title="Life Number"
                symbol="∞"
                description={`Your life number is ${result.lifeNumber.number}. These cards share the same numerological attributes.`}
              >
                <div className="flex flex-wrap gap-6 justify-center">
                  {result.lifeNumber.cards.map((card) => (
                    <div key={card.idx} className="flex flex-col items-center">
                      <TarotCard card={card} small={false} showMeaning={true} />
                    </div>
                  ))}
                </div>
              </SignificatorSection>
            </div>

            {/* Decanate - Full width */}
            {result.decanate && (
              <div className="mb-8">
                <SignificatorSection
                  title="Decanate"
                  symbol="⚶"
                  description={`Your decanate card from ${result.decanate.sign} is ${result.decanate.decanateCard}, connecting your birth date to the Minor Arcana.`}
                >
                  <div className="flex justify-center">
                    <div className="flex flex-col items-center">
                      <TarotCard
                        card={result.decanate.card}
                        small={false}
                        showMeaning={true}
                      />
                    </div>
                  </div>
                </SignificatorSection>
              </div>
            )}

            {/* Interpretation note */}
            <div className="text-center mt-12">
              <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#d4af37]/50 to-transparent mx-auto mb-6" />
              <p
                className="text-[#e6d5b8]/70 text-sm sm:text-base italic max-w-2xl mx-auto"
                style={{ fontFamily: "'Crimson Pro', serif" }}
              >
                When these cards appear in your readings, pay special
                attention—they often carry messages directly relevant to your
                life path and current circumstances.
              </p>
            </div>
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
