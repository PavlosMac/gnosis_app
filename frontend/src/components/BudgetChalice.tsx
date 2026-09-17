import { useId } from "react";
import {
  budgetCaption,
  chaliceFill,
  chaliceState,
} from "@/lib/profile-dashboard";

interface BudgetChaliceProps {
  remainingUsd: number;
  budgetUsd: number;
  className?: string;
}

// Bowl interior in viewBox units: the liquid surface travels between these
const BOWL_TOP_Y = 32;
const BOWL_BOTTOM_Y = 89;

/** Liquid surface y for a fill fraction — exported for the markup test */
export const surfaceYFor = (fraction: number): number =>
  BOWL_BOTTOM_Y - fraction * (BOWL_BOTTOM_Y - BOWL_TOP_Y);

const LIQUID_STOPS: Record<"full" | "partial" | "low", [string, string, string]> = {
  full: ["#f0d97a", "#d4af37", "#8a6a1f"],
  partial: ["#e6c84a", "#d4af37", "#8a6a1f"],
  low: ["#c98a2e", "#a3641c", "#7a3f10"],
};

/**
 * The Oracle budget as a filled chalice: the liquid level is remaining/budget.
 * Server component — every load-bearing value is an SVG attribute computed here;
 * the only CSS dependency is the keyframe classes in tarot.css (waves, shimmer,
 * glow, rise-on-load), all of which stop under prefers-reduced-motion. The
 * clipPath is static and only its contents animate (Safari repaints reliably),
 * transforms are pure translations on nested <g>s, and no element carries both a
 * transform attribute and a CSS transform.
 */
const BudgetChalice = ({ remainingUsd, budgetUsd, className }: BudgetChaliceProps) => {
  const fraction = chaliceFill(remainingUsd, budgetUsd);
  // React ids contain colons; keep url(#…) references plain in every engine
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  if (fraction === null) return null;

  const state = chaliceState(fraction);
  const surfaceY = surfaceYFor(fraction);
  const caption = budgetCaption(remainingUsd, budgetUsd);
  const titleId = `chalice-title-${uid}`;
  const clipId = `chalice-bowl-${uid}`;
  const liquidId = `chalice-liquid-${uid}`;
  const shimmerId = `chalice-shimmer-${uid}`;
  const glowId = `chalice-glow-${uid}`;
  const stops = state === "empty" ? null : LIQUID_STOPS[state];

  return (
    <div
      className={className}
      style={{
        width: "100%",
        maxWidth: 160,
        filter: "drop-shadow(0 0 18px rgba(212,175,55,0.35))",
      }}
    >
      <svg
        viewBox="0 0 120 160"
        role="img"
        aria-labelledby={titleId}
        style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
      >
        <title id={titleId}>{`Oracle budget: ${caption}`}</title>
        <defs>
          <clipPath id={clipId}>
            <path d="M23 32 Q23 89 60 89 Q97 89 97 32 Z" />
          </clipPath>
          {stops && (
            <linearGradient
              id={liquidId}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="0"
              y2="70"
            >
              <stop offset="0" stopColor={stops[0]} stopOpacity="0.95" />
              <stop offset="0.45" stopColor={stops[1]} stopOpacity="0.9" />
              <stop offset="1" stopColor={stops[2]} stopOpacity="0.95" />
            </linearGradient>
          )}
          <linearGradient id={shimmerId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff4c8" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff4c8" stopOpacity="0.28" />
            <stop offset="1" stopColor="#fff4c8" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={glowId} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#d4af37" stopOpacity="0.35" />
            <stop offset="1" stopColor="#d4af37" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient halo behind the bowl */}
        <ellipse
          className="chalice-glow"
          cx="60"
          cy="62"
          rx="54"
          ry="46"
          fill={`url(#${glowId})`}
          aria-hidden="true"
        />

        {/* Bowl body (drawn under the liquid so the liquid reads as inside it) */}
        <path
          d="M20 30 Q20 92 60 92 Q100 92 100 30 Z"
          fill="rgba(26,0,51,0.55)"
          stroke="none"
        />

        {/* Liquid, clipped to the bowl interior */}
        <g clipPath={`url(#${clipId})`} aria-hidden="true">
          {stops ? (
            <g transform={`translate(0 ${surfaceY})`}>
              <g className="chalice-rise">
                <rect x="0" y="0" width="120" height="70" fill={`url(#${liquidId})`} />
                <g className="chalice-wave">
                  <path
                    d="M-120 0 Q-90 -4 -60 0 T0 0 T60 0 T120 0 T180 0 T240 0 V14 H-120 Z"
                    fill={`url(#${liquidId})`}
                  />
                </g>
                <g className="chalice-wave chalice-wave--slow">
                  <path
                    d="M-120 0 Q-90 -3 -60 0 T0 0 T60 0 T120 0 T180 0 T240 0 V12 H-120 Z"
                    fill={stops[0]}
                    fillOpacity="0.45"
                  />
                </g>
                <g className="chalice-shimmer">
                  <rect x="-40" y="0" width="40" height="80" fill={`url(#${shimmerId})`} />
                </g>
              </g>
            </g>
          ) : (
            <line
              x1="30"
              y1="86"
              x2="90"
              y2="86"
              stroke="#d4af37"
              strokeOpacity="0.35"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
          )}
        </g>

        {/* Goblet outline */}
        <g fill="none" stroke="#d4af37" strokeLinecap="round" aria-hidden="true">
          <path d="M20 30 Q20 92 60 92 Q100 92 100 30" strokeWidth="2.2" />
          <path d="M26 34 Q26 84 60 86 Q94 84 94 34" strokeWidth="0.8" strokeOpacity="0.5" />
          <ellipse cx="60" cy="30" rx="40" ry="6" strokeWidth="2.2" fill="rgba(26,0,51,0.35)" />
          {/* highlight on the left of the bowl */}
          <path d="M29 42 Q28 66 40 80" strokeWidth="1.2" stroke="#fff4c8" strokeOpacity="0.35" />
          {/* stem, knop, foot */}
          <rect x="56" y="92" width="8" height="34" rx="2" strokeWidth="1.8" fill="rgba(26,0,51,0.6)" />
          <ellipse cx="60" cy="110" rx="9" ry="5" strokeWidth="1.8" fill="rgba(26,0,51,0.7)" />
          <ellipse cx="60" cy="134" rx="30" ry="10" strokeWidth="1.2" strokeOpacity="0.4" />
          <ellipse cx="60" cy="132" rx="30" ry="8" strokeWidth="2" fill="rgba(26,0,51,0.6)" />
        </g>
        <text
          x="60"
          y="112.5"
          textAnchor="middle"
          fontSize="7"
          fill="#d4af37"
          fillOpacity="0.9"
          aria-hidden="true"
        >
          ✦
        </text>
      </svg>
    </div>
  );
};

export default BudgetChalice;
