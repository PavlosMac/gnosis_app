import React from "react";
import type { SignificatorPosition } from "@/lib/about-content";

interface SignificatorPositionCardsProps {
  positions: SignificatorPosition[];
}

/** The five significator positions from readings-config.json as small cards. */
const SignificatorPositionCards: React.FC<SignificatorPositionCardsProps> = ({ positions }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {positions.map((position, i) => {
      const last = i === positions.length - 1;
      const spansRow = last && positions.length % 2 === 1;
      return (
        <div
          key={position.key}
          className={`p-4 border border-[#d4af37]/30 rounded-lg bg-[#1a0033]/50${spansRow ? " sm:col-span-2" : ""}`}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[#d4af37]/60 text-xl" aria-hidden="true">
              {position.symbol}
            </span>
            <h3
              className="text-base sm:text-lg text-[#d4af37] tracking-wider"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              {position.title}
            </h3>
          </div>
          <p
            className="text-[#e6d5b8]/80 text-sm sm:text-base leading-relaxed"
            style={{ fontFamily: "'Crimson Pro', serif" }}
          >
            {position.description}
          </p>
        </div>
      );
    })}
  </div>
);

export default SignificatorPositionCards;
