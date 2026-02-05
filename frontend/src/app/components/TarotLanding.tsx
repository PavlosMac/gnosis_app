"use client";
import React from "react";
import Link from "next/link";

const TarotLanding: React.FC = () => {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-16">
        <h1
          className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-bold text-[#d4af37] tracking-[0.15em] sm:tracking-[0.2em]"
          style={{
            fontFamily: "'Cinzel', serif",
            textShadow: "0 0 40px rgba(212,175,55,0.4), 0 4px 20px rgba(0,0,0,0.5)",
          }}
        >
          Tarot
        </h1>
        <h2
          className="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold text-[#d4af37]/80 tracking-[0.15em] sm:tracking-[0.3em] mt-1"
          style={{
            fontFamily: "'Cinzel', serif",
            textShadow: "0 0 30px rgba(212,175,55,0.3)",
          }}
        >
          Divination
        </h2>

        {/* Decorative line with ankh */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <div className="w-20 sm:w-32 h-px bg-gradient-to-r from-transparent via-[#d4af37]/60 to-[#d4af37]" />
          <span className="text-[#d4af37] text-2xl">☥</span>
          <div className="w-20 sm:w-32 h-px bg-gradient-to-l from-transparent via-[#d4af37]/60 to-[#d4af37]" />
        </div>

        <p
          className="text-[#e6d5b8]/80 text-lg sm:text-xl mt-6 max-w-2xl mx-auto leading-relaxed"
          style={{ fontFamily: "'Crimson Pro', serif" }}
        >
          Enter the sacred realm of the Tarot. Discover ancient wisdom,
          learn the mysteries of the cards, and receive divine guidance.
        </p>
      </div>

      {/* Articles Section */}
      <div className="mb-12">
        <div className="text-center mb-6">
          <span
            className="text-sm sm:text-base text-[#d4af37]/60 tracking-[0.3em] uppercase"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Sacred Knowledge
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Your Tarot Chart - Article */}
          <Link
            href="/chart"
            className="group relative overflow-hidden rounded-xl border border-[#d4af37]/30
                       bg-gradient-to-br from-[#1a0033]/90 to-[#2d1b4e]/90
                       backdrop-blur-sm p-8 text-left transition-all duration-500
                       hover:border-[#d4af37]/60 hover:shadow-[0_0_40px_rgba(212,175,55,0.15)]
                       focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500
                            bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.08),transparent_70%)]" />

            <div className="relative mb-4">
              <span className="text-4xl opacity-80 group-hover:opacity-100 transition-opacity">☉</span>
            </div>

            <h3
              className="relative text-2xl text-[#d4af37] tracking-wide mb-3
                         group-hover:text-[#e6c860] transition-colors"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Your Tarot Chart
            </h3>
            <p
              className="relative text-[#e6d5b8]/70 text-base leading-relaxed
                         group-hover:text-[#e6d5b8]/90 transition-colors"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              Discover your personal tarot significators and understand
              how the cards align with your unique journey.
            </p>

            <div className="absolute top-6 right-6">
              <span
                className="text-xs text-[#d4af37]/50 tracking-widest uppercase
                           border border-[#d4af37]/20 px-3 py-1 rounded-full"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Article
              </span>
            </div>
          </Link>

          {/* How to use the Oracle - Article */}
          <Link
            href="/guide"
            className="group relative overflow-hidden rounded-xl border border-[#d4af37]/30
                       bg-gradient-to-br from-[#1a0033]/90 to-[#2d1b4e]/90
                       backdrop-blur-sm p-8 text-left transition-all duration-500
                       hover:border-[#d4af37]/60 hover:shadow-[0_0_40px_rgba(212,175,55,0.15)]
                       focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500
                            bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.08),transparent_70%)]" />

            <div className="relative mb-4">
              <span className="text-4xl opacity-80 group-hover:opacity-100 transition-opacity">☾</span>
            </div>

            <h3
              className="relative text-2xl text-[#d4af37] tracking-wide mb-3
                         group-hover:text-[#e6c860] transition-colors"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              How to use the Oracle
            </h3>
            <p
              className="relative text-[#e6d5b8]/70 text-base leading-relaxed
                         group-hover:text-[#e6d5b8]/90 transition-colors"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              Learn the sacred art of tarot reading. Prepare your space,
              formulate questions, and interpret the ancient symbols.
            </p>

            <div className="absolute top-6 right-6">
              <span
                className="text-xs text-[#d4af37]/50 tracking-widest uppercase
                           border border-[#d4af37]/20 px-3 py-1 rounded-full"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Article
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center justify-center gap-6 my-10">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#d4af37]/30" />
        <span className="text-[#d4af37]/60 text-lg">✦</span>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#d4af37]/30" />
      </div>

      {/* Interactive Oracle Tools */}
      <div className="mb-8">
        <div className="text-center mb-8">
          <span
            className="text-sm sm:text-base text-[#d4af37]/60 tracking-[0.3em] uppercase"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Divine Tools
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Significators - Interactive Card Portal */}
          <Link
            href="/significators"
            className="group relative overflow-hidden rounded-2xl
                       bg-gradient-to-br from-[#0a0015] via-[#1a0033] to-[#2d1b4e]
                       p-1 transition-all duration-700
                       hover:shadow-[0_0_80px_rgba(212,175,55,0.3)]
                       focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
          >
            {/* Animated border */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#d4af37]/40 via-[#8b5cf6]/40 to-[#d4af37]/40
                            opacity-60 group-hover:opacity-100 transition-opacity duration-500
                            animate-border-flow" />

            <div className="relative rounded-xl bg-gradient-to-br from-[#0a0015] via-[#1a0033] to-[#2d1b4e]
                            p-8 h-full">

              {/* Floating court card silhouettes */}
              <div className="absolute top-6 right-6 flex gap-1">
                <div className="w-8 h-12 rounded border border-[#d4af37]/30 bg-gradient-to-b from-[#d4af37]/10 to-transparent
                                transform rotate-[-8deg] group-hover:rotate-[-12deg] group-hover:translate-y-[-4px]
                                transition-all duration-500 flex items-center justify-center">
                  <span className="text-[#d4af37]/40 text-xs">♔</span>
                </div>
                <div className="w-8 h-12 rounded border border-[#d4af37]/40 bg-gradient-to-b from-[#d4af37]/15 to-transparent
                                transform rotate-[4deg] group-hover:rotate-[8deg] group-hover:translate-y-[-8px]
                                transition-all duration-500 delay-75 flex items-center justify-center">
                  <span className="text-[#d4af37]/50 text-xs">♕</span>
                </div>
                <div className="w-8 h-12 rounded border border-[#d4af37]/30 bg-gradient-to-b from-[#d4af37]/10 to-transparent
                                transform rotate-[12deg] group-hover:rotate-[16deg] group-hover:translate-y-[-4px]
                                transition-all duration-500 delay-150 flex items-center justify-center">
                  <span className="text-[#d4af37]/40 text-xs">♘</span>
                </div>
              </div>

              {/* Mystical symbol */}
              <div className="relative mb-6 w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#8b5cf6]/20 to-[#d4af37]/20
                                group-hover:from-[#8b5cf6]/40 group-hover:to-[#d4af37]/40
                                transition-all duration-500 animate-pulse-slow" />
                <div className="absolute inset-2 rounded-full border border-[#d4af37]/30
                                group-hover:border-[#d4af37]/60 transition-colors" />
                <span className="text-3xl text-[#d4af37] relative z-10
                                 group-hover:scale-110 transition-transform duration-300">⚝</span>
              </div>

              <h3
                className="text-2xl sm:text-3xl text-[#d4af37] tracking-wide mb-4
                           group-hover:text-[#e6c860] transition-colors"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Significators
              </h3>

              <p
                className="text-[#e6d5b8]/70 text-base leading-relaxed mb-6
                           group-hover:text-[#e6d5b8]/90 transition-colors max-w-xs"
                style={{ fontFamily: "'Crimson Pro', serif" }}
              >
                The Court Cards mirror your soul. Discover which King, Queen,
                Knight, or Page embodies your essence and those around you.
              </p>

              {/* Enter prompt */}
              <div className="flex items-center gap-2 text-[#d4af37]/60 group-hover:text-[#d4af37]
                              transition-colors">
                <span
                  className="text-sm tracking-widest uppercase"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  Discover Yourself
                </span>
                <span className="text-lg group-hover:translate-x-2 transition-transform duration-300">→</span>
              </div>
            </div>
          </Link>

          {/* Reading Oracle - The Grand Portal */}
          <Link
            href="/reading"
            className="group relative overflow-hidden rounded-2xl
                       bg-gradient-to-br from-[#0a0015] via-[#1a0033] to-[#2d1b4e]
                       p-1 transition-all duration-700
                       hover:shadow-[0_0_100px_rgba(212,175,55,0.4)]
                       focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
          >
            {/* Animated golden border */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#d4af37]/60 via-[#ffd700]/60 to-[#d4af37]/60
                            opacity-70 group-hover:opacity-100 transition-opacity duration-500
                            animate-border-flow-fast" />

            <div className="relative rounded-xl bg-gradient-to-br from-[#0a0015] via-[#1a0033] to-[#2d1b4e]
                            p-8 h-full overflow-hidden">

              {/* Mystical orb/crystal ball effect */}
              <div className="absolute top-4 right-4 w-24 h-24">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#d4af37]/5 via-[#8b5cf6]/10 to-transparent
                                group-hover:from-[#d4af37]/20 group-hover:via-[#8b5cf6]/20
                                transition-all duration-700 animate-orb-pulse" />
                <div className="absolute inset-4 rounded-full bg-gradient-to-tl from-[#d4af37]/10 to-transparent
                                group-hover:from-[#d4af37]/30 transition-all duration-500" />

                {/* Floating tarot cards inside orb */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <div className="absolute w-6 h-9 rounded-sm border border-[#d4af37]/40
                                    bg-gradient-to-b from-[#1a0033] to-[#0a0015]
                                    transform -rotate-12 -translate-x-3
                                    group-hover:-rotate-20 group-hover:-translate-x-4 group-hover:-translate-y-1
                                    transition-all duration-500 shadow-lg" />
                    <div className="absolute w-6 h-9 rounded-sm border border-[#d4af37]/60
                                    bg-gradient-to-b from-[#2d1b4e] to-[#1a0033]
                                    transform rotate-0
                                    group-hover:translate-y-[-4px]
                                    transition-all duration-500 delay-75 shadow-lg" />
                    <div className="w-6 h-9 rounded-sm border border-[#d4af37]/40
                                    bg-gradient-to-b from-[#1a0033] to-[#0a0015]
                                    transform rotate-12 translate-x-3
                                    group-hover:rotate-20 group-hover:translate-x-4 group-hover:-translate-y-1
                                    transition-all duration-500 delay-150 shadow-lg" />
                  </div>
                </div>
              </div>

              {/* Central icon with glow */}
              <div className="relative mb-6 w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-[#d4af37]/10
                                group-hover:bg-[#d4af37]/25 transition-all duration-500
                                animate-glow-pulse" />
                <div className="absolute inset-0 rounded-full border-2 border-[#d4af37]/30
                                group-hover:border-[#d4af37]/70 group-hover:scale-110
                                transition-all duration-500" />
                <div className="absolute inset-3 rounded-full border border-[#d4af37]/20
                                group-hover:border-[#d4af37]/50 transition-colors" />
                <span className="text-4xl relative z-10 group-hover:scale-110 transition-transform duration-300">✧</span>
              </div>

              <h3
                className="text-2xl sm:text-3xl text-[#d4af37] tracking-wide mb-4
                           group-hover:text-[#ffd700] transition-colors"
                style={{
                  fontFamily: "'Cinzel', serif",
                  textShadow: "0 0 20px rgba(212,175,55,0.3)",
                }}
              >
                Reading Oracle
              </h3>

              <p
                className="text-[#e6d5b8]/70 text-base leading-relaxed mb-6
                           group-hover:text-[#e6d5b8] transition-colors max-w-xs"
                style={{ fontFamily: "'Crimson Pro', serif" }}
              >
                The cards await your question. Draw from the sacred deck
                and let the ancient symbols illuminate your path forward.
              </p>

              {/* Grand enter button */}
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-lg
                              border border-[#d4af37]/40 bg-gradient-to-r from-[#d4af37]/10 to-transparent
                              group-hover:border-[#d4af37] group-hover:bg-[#d4af37]/20
                              transition-all duration-500">
                <span
                  className="text-sm text-[#d4af37] tracking-widest uppercase
                             group-hover:text-[#ffd700] transition-colors"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  Consult the Oracle
                </span>
                <span className="text-xl text-[#d4af37] group-hover:text-[#ffd700]
                                 group-hover:translate-x-2 transition-all duration-300">→</span>
              </div>
            </div>
          </Link>
        </div>
      </div>

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
  );
};

export default TarotLanding;
