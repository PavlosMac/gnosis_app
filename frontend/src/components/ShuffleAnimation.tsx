"use client";
import React, { useEffect } from "react";
import ShuffleOrbit from "@/components/ShuffleOrbit";

interface ShuffleAnimationProps {
  onComplete: () => void;
}

const ANIMATION_DURATION = 5000; // 5 seconds

const ShuffleAnimation: React.FC<ShuffleAnimationProps> = React.memo(({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, ANIMATION_DURATION);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="shuffle-container flex flex-col items-center justify-center py-12">
      <ShuffleOrbit />

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
});

ShuffleAnimation.displayName = 'ShuffleAnimation';

export default ShuffleAnimation;
