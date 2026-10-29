import React from "react";

/** Static dots paint once into the fixed background layer, so the count only affects
 *  first paint. 40 reads as a full sky on a dark gradient. */
export const STAR_COUNT = 40;

/** Deterministic positions and brightness: identical on server and client, no hydration
 *  mismatch. Brightness spans the range the old twinkle used to sweep through. */
export const buildStars = (count: number = STAR_COUNT) =>
  [...Array(count)].map((_, i) => ({
    left: `${(i * 7.3 + 13) % 100}%`,
    top: `${(i * 11.7 + 23) % 100}%`,
    opacity: Math.round((0.2 + ((i * 0.15) % 0.4)) * 100) / 100,
  }));

const STARS = buildStars();

/**
 * The mystical page background: gradient, static stars, ambient glows and a vignette.
 * Fixed behind page content, never intercepts clicks. Nothing here animates: an
 * always-on background animation was the one cost every page paid while idle.
 */
const Starfield = () => (
  <div
    aria-hidden="true"
    className="fixed inset-0 bg-gradient-to-b from-[#0a0015] via-[#1a0033] to-[#2d1b4e] pointer-events-none"
  >
    {STARS.map((star, i) => (
      <div key={i} data-star="" className="absolute w-1 h-1 bg-white rounded-full" style={star} />
    ))}
    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,rgba(212,175,55,0.15),transparent_50%)]" />
    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_70%_60%,rgba(138,43,226,0.15),transparent_50%)]" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.7)_100%)]" />
  </div>
);

export default Starfield;
