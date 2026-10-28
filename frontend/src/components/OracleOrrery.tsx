"use client";

import React, { useEffect, useMemo, useState } from "react";

// Loading state for the interpretation modal: three bodies on counter-rotating orbits
// around a pulsing sun, over a small twinkling starfield. Pure CSS motion (keyframes in
// tarot.css); the only JavaScript is the caption cycling. Everything visual is
// aria-hidden — the status region announces one stable sentence instead of a new
// phrase every few seconds.

export const ORRERY_PHRASES = [
  // Keep the first phrase: the user guide quotes it (src/content/guide/oracle-interpretation.mdx)
  "The Oracle consults the stars...",
  "The planets align...",
  "The numbers are weighed...",
  "The cards begin to speak...",
] as const;

const PHRASE_INTERVAL_MS = 3500;
const STAR_COUNT = 24;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const CINZEL = { fontFamily: "'Cinzel', serif" } as const;
const CRIMSON = { fontFamily: "'Crimson Pro', serif" } as const;

interface OrbitBody {
  radius: number;      // px from the stage centre; the ring is drawn at the same radius
  duration: number;    // seconds per revolution
  direction: "normal" | "reverse";
  restAngle: number;   // where the body sits when motion is reduced (orbits stop)
  glyph?: string;      // a dot when absent
  className: string;
}

// Distinct periods so the configuration never visibly repeats; the outer body is a
// crescent so the three read as sun, planet and moon rather than three dots.
const BODIES: readonly OrbitBody[] = [
  {
    radius: 40, duration: 6, direction: "normal", restAngle: 0,
    className: "w-2.5 h-2.5 rounded-full bg-[#d4af37] shadow-[0_0_10px_rgba(212,175,55,0.8)]",
  },
  {
    radius: 72, duration: 10, direction: "reverse", restAngle: 130,
    className: "w-3 h-3 rounded-full bg-[#8a2be2] shadow-[0_0_12px_rgba(138,43,226,0.8)]",
  },
  {
    radius: 104, duration: 16, direction: "normal", restAngle: 250, glyph: "☽",
    className: "text-sm leading-none text-[#e6d5b8] drop-shadow-[0_0_6px_rgba(230,213,184,0.8)]",
  },
];

// Same deterministic scatter the page starfields use: stable markup, no hydration drift
const makeStars = () =>
  Array.from({ length: STAR_COUNT }, (_, i) => ({
    left: `${((i * 7.3 + 13) % 100).toFixed(1)}%`,
    top: `${((i * 11.7 + 23) % 100).toFixed(1)}%`,
    animationDelay: `${((i * 0.37) % 3).toFixed(2)}s`,
    animationDuration: `${(2 + ((i * 0.29) % 2)).toFixed(2)}s`,
  }));

interface OracleOrreryProps {
  className?: string;
}

const OracleOrrery: React.FC<OracleOrreryProps> = React.memo(({ className = "py-10" }) => {
  const stars = useMemo(makeStars, []);
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
    const timer = setInterval(
      () => setPhraseIndex((i) => (i + 1) % ORRERY_PHRASES.length),
      PHRASE_INTERVAL_MS
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`oracle-orrery flex flex-col items-center ${className}`}
    >
      <span className="sr-only">The Oracle is preparing your interpretation.</span>

      {/* Stage: fixed 224px so the pixel orbit radii stay concentric with their rings */}
      <div aria-hidden="true" className="relative w-56 h-56">
        {/* Starfield */}
        {stars.map((star, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-twinkle"
            style={star}
          />
        ))}

        {/* Glow */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#d4af37]/10 via-transparent to-[#8b5cf6]/10 blur-xl" />

        {/* Orbit rings */}
        {BODIES.map(({ radius }) => (
          <div
            key={radius}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#d4af37]/20"
            style={{ width: radius * 2, height: radius * 2 }}
          />
        ))}

        {/* Orbiting bodies: the 0×0 wrapper sits at the centre and carries the orbit
            transform; the inline transform is the resting pose under reduced motion */}
        {BODIES.map(({ radius, duration, direction, restAngle, glyph, className: bodyClass }) => (
          <div
            key={radius}
            className="orrery-body absolute top-1/2 left-1/2 w-0 h-0"
            style={{
              "--orbit-radius": `${radius}px`,
              "--orbit-duration": `${duration}s`,
              "--orbit-direction": direction,
              transform: `rotate(${restAngle}deg) translateX(${radius}px) rotate(${-restAngle}deg)`,
            } as React.CSSProperties}
          >
            <div className={`-translate-x-1/2 -translate-y-1/2 ${bodyClass}`}>{glyph}</div>
          </div>
        ))}

        {/* Sun */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-orb-pulse w-14 h-14 rounded-full border-2 border-[#d4af37]/50 bg-[#1a0033]/60 flex items-center justify-center shadow-[0_0_24px_rgba(212,175,55,0.35)]">
            <span
              aria-hidden="true"
              className="text-2xl text-[#d4af37]"
              style={{ textShadow: "0 0 20px rgba(212,175,55,0.5)" }}
            >
              ☉
            </span>
          </div>
        </div>
      </div>

      {/* Captions */}
      <div aria-hidden="true" className="mt-6 text-center px-4">
        <p
          key={phraseIndex}
          className="orrery-caption text-lg text-[#d4af37]/80 tracking-wider"
          style={CINZEL}
        >
          {ORRERY_PHRASES[phraseIndex]}
        </p>
        <p className="text-sm italic text-[#e6d5b8]/60 mt-2" style={CRIMSON}>
          A large reading can take a little while.
        </p>
      </div>
    </div>
  );
});

OracleOrrery.displayName = "OracleOrrery";

export default OracleOrrery;
