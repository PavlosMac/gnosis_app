import React from "react";
import TarotCard from "@/components/TarotCard";
import SignificatorSection from "@/components/SignificatorSection";
import type { SignificatorResult } from "@/lib/significators";

interface SignificatorsLayoutProps {
  significatorResult?: SignificatorResult;
}

const SignificatorsLayout: React.FC<SignificatorsLayoutProps> = ({
  significatorResult: result,
}) => {
  if (!result) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
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
          attention - they often carry messages directly relevant to your
          life path and current circumstances.
        </p>
      </div>
    </div>
  );
};

export default SignificatorsLayout;
