"use client";
import React, { useEffect } from "react";

interface ShuffleAnimationProps {
  onComplete: () => void;
}

const CARD_COUNT = 10;
const ANIMATION_DURATION = 5000; // 5 seconds

const ShuffleAnimation: React.FC<ShuffleAnimationProps> = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, ANIMATION_DURATION);

    return () => clearTimeout(timer);
  }, [onComplete]);

  // Generate card positions in a circle
  const cards = Array.from({ length: CARD_COUNT }, (_, i) => {
    const angle = (i * 360) / CARD_COUNT;
    const delay = i * 0.1; // Staggered delay
    return { angle, delay };
  });

  return (
    <div className="shuffle-container flex flex-col items-center justify-center py-12">
      <div className="relative w-64 h-64 flex items-center justify-center">
        {/* Center symbol */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="shuffle-center-symbol w-20 h-20 rounded-full border-2 border-[#d4af37]/40 flex items-center justify-center bg-[#1a0033]/50">
            <span className="text-4xl text-[#d4af37]">☥</span>
          </div>
        </div>

        {/* Rotating cards */}
        {cards.map((card, i) => (
          <div
            key={i}
            className="shuffle-card absolute"
            style={{
              transformOrigin: "center center",
              animationDelay: `${card.delay}s`,
              transform: `rotate(${card.angle}deg) translateX(80px) rotate(-${card.angle}deg)`,
            }}
          >
            <div
              className="w-14 h-24 rounded-lg border-2 border-[#d4af37]/60
                         bg-gradient-to-br from-[#1a0033] via-[#2d1b4e] to-[#1a0033]
                         flex items-center justify-center shadow-lg
                         shadow-[#d4af37]/20"
            >
              <span className="text-2xl text-[#d4af37]/80">☥</span>
            </div>
          </div>
        ))}

        {/* Glow effect behind cards */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#d4af37]/10 via-transparent to-[#8b5cf6]/10 blur-xl" />
      </div>

      {/* Text below animation */}
      <div className="mt-8 text-center">
        <p
          className="text-lg text-[#d4af37]/80 tracking-wider"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          Shuffling the Sacred Deck
        </p>
        <p
          className="text-sm text-[#e6d5b8]/60 mt-2"
          style={{ fontFamily: "'Crimson Pro', serif" }}
        >
          Focus on your question...
        </p>
      </div>
    </div>
  );
};

export default ShuffleAnimation;
