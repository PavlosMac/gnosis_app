"use client";
import React from "react";

// The circling cards around the ankh — one visual, two waits. ShuffleAnimation plays the
// shuffle once (5 s, then hands over to the spread); the interpretation modal repeats the
// same shuffle for as long as the Oracle takes.

const CARD_COUNT = 10;
const ORBIT_RADIUS_PX = 80;

// Deterministic positions: no randomness, so server and client markup agree
const CARDS = Array.from({ length: CARD_COUNT }, (_, i) => ({
  angle: (i * 360) / CARD_COUNT,
  delay: i * 0.1, // staggered entrance
}));

// The keyframes in tarot.css read --orbit-radius; the inline transform is the card's resting
// slot, which is what reduced motion shows.
const cardStyle = ({ angle, delay }: (typeof CARDS)[number]): React.CSSProperties =>
  ({
    transformOrigin: "center center",
    animationDelay: `${delay}s`,
    transform: `rotate(${angle}deg) translateX(${ORBIT_RADIUS_PX}px) rotate(-${angle}deg)`,
    "--orbit-radius": `${ORBIT_RADIUS_PX}px`,
  }) as React.CSSProperties;

interface ShuffleOrbitProps {
  // Repeat the shuffle instead of stopping after one pass
  loop?: boolean;
}

const ShuffleOrbit: React.FC<ShuffleOrbitProps> = React.memo(({ loop = false }) => (
  <div className="relative w-64 h-64 flex items-center justify-center" aria-hidden="true">
    {/* Center symbol */}
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="shuffle-center-symbol w-20 h-20 rounded-full border-2 border-[#d4af37]/40 flex items-center justify-center bg-[#1a0033]/50">
        <span className="text-4xl text-[#d4af37]">☥</span>
      </div>
    </div>

    {/* Rotating cards */}
    {CARDS.map((card, i) => (
      <div
        key={i}
        className={`shuffle-card ${loop ? "shuffle-card--loop " : ""}absolute`}
        style={cardStyle(card)}
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
));

ShuffleOrbit.displayName = "ShuffleOrbit";

export default ShuffleOrbit;
