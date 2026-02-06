"use client";
import Link from "next/link";
import { Cinzel, Crimson_Pro } from "next/font/google";
import { useMemo } from "react";
import "../tarot.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-cinzel",
});

const crimsonPro = Crimson_Pro({
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  variable: "--font-crimson-pro",
});

interface SectionProps {
  title: string;
  symbol?: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, symbol = "✦", children }) => {
  return (
    <div className="mb-12">
      <div className="flex items-center justify-center gap-4 mb-6">
        <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#d4af37]/50" />
        <span className="text-[#d4af37]/60">{symbol}</span>
        <h2
          className="text-xl sm:text-2xl text-[#d4af37] tracking-wider text-center"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          {title}
        </h2>
        <span className="text-[#d4af37]/60">{symbol}</span>
        <div className="w-12 h-px bg-gradient-to-l from-transparent to-[#d4af37]/50" />
      </div>
      {children}
    </div>
  );
};

export default function GuidePage() {
  const stars = useMemo(
    () =>
      [...Array(100)].map((_, i) => ({
        left: `${(i * 7.3 + 13) % 100}%`,
        top: `${(i * 11.7 + 23) % 100}%`,
        animationDelay: `${(i * 0.37) % 3}s`,
        animationDuration: `${2 + (i * 0.29) % 2}s`,
      })),
    []
  );

  return (
    <main
      className={`min-h-screen relative overflow-hidden ${cinzel.variable} ${crimsonPro.variable}`}
    >
      {/* Mystical starfield background */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#0a0015] via-[#1a0033] to-[#2d1b4e]">
        <div className="absolute inset-0 opacity-60">
          {stars.map((star, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-twinkle"
              style={star}
            />
          ))}
        </div>
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,rgba(212,175,55,0.15),transparent_50%)]" />
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_70%_60%,rgba(138,43,226,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.7)_100%)]" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-start pt-10 px-4 pb-10">
        {/* Back button */}
        <Link
          href="/"
          className="absolute top-4 left-4 z-20 flex items-center gap-2 px-4 py-2
                     text-[#d4af37]/70 hover:text-[#d4af37] transition-colors"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          <span>←</span>
          <span className="text-sm tracking-wider">Portal</span>
        </Link>

        <div className="w-full max-w-3xl mx-auto">
          {/* Page Header */}
          <div className="text-center mb-12">
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#d4af37] tracking-wider mb-4"
              style={{
                fontFamily: "'Cinzel', serif",
                textShadow: "0 0 30px rgba(212,175,55,0.4)",
              }}
            >
              How to Use the Oracle
            </h1>
            <div className="flex items-center justify-center gap-4 mt-4">
              <div className="w-24 h-px bg-gradient-to-r from-transparent via-[#d4af37]/60 to-[#d4af37]" />
              <span className="text-[#d4af37] text-xl">☥</span>
              <div className="w-24 h-px bg-gradient-to-l from-transparent via-[#d4af37]/60 to-[#d4af37]" />
            </div>
            <p
              className="text-[#e6d5b8]/70 text-lg sm:text-xl mt-6 max-w-2xl mx-auto leading-relaxed"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              A guide to receiving meaningful guidance from the Tarot
            </p>
          </div>

          {/* Intent is Key */}
          <Section title="Intent is Key" symbol="✧">
            <div
              className="space-y-4 text-[#e6d5b8]/90 leading-relaxed"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              <p className="text-lg sm:text-xl">
                The most important element of any Tarot reading is your
                intention. Before selecting your cards, take a moment to center
                yourself and form a clear question or area of focus in your
                mind.
              </p>
              <p className="text-lg sm:text-xl">
                The Tarot responds to the energy and intention you bring to it.
                A scattered mind produces scattered answers. A focused,
                receptive state allows the cards to speak with clarity and
                precision.
              </p>
              <p className="text-lg sm:text-xl italic text-[#e6d5b8]/70">
                Think of the reading as a conversation with your unconscious, the
                part of you that already knows the answers you seek.
              </p>
            </div>
          </Section>

          {/* Framing Your Question */}
          <Section title="Framing Your Question" symbol="☾">
            <div
              className="space-y-4 text-[#e6d5b8]/90 leading-relaxed"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              <p className="text-lg sm:text-xl">
                The way you frame your question profoundly affects the answer
                you receive. Open-ended questions yield the richest insights.
                Instead of asking &ldquo;Will I...?&rdquo; try &ldquo;What do I
                need to understand about...?&rdquo;
              </p>
              <p className="text-lg sm:text-xl">
                A powerful way to begin is with the phrase:{" "}
                <span className="text-[#d4af37]">
                  &ldquo;I would like to ask the inner oracle...&rdquo;
                </span>
              </p>
              <p className="text-lg sm:text-xl">
                This invocation acknowledges that the wisdom comes from within
                you, reflected through the symbolic mirror of the cards. The
                Tarot doesn&apos;t predict a fixed future - it reveals the
                energies and patterns currently at play, offering guidance on
                how to navigate them.
              </p>
              <div className="mt-6 p-4 border border-[#d4af37]/30 rounded-lg bg-[#1a0033]/50">
                <p className="text-[#d4af37]/80 text-sm uppercase tracking-widest mb-2" style={{ fontFamily: "'Cinzel', serif" }}>
                  Example Questions
                </p>
                <ul className="list-disc list-inside space-y-2 text-[#e6d5b8]/80">
                  <li>&ldquo;What do I need to know about my current situation?&rdquo;</li>
                  <li>&ldquo;What energies surround my relationship with...?&rdquo;</li>
                  <li>&ldquo;What is blocking my progress in...?&rdquo;</li>
                  <li>&ldquo;How can I best approach this decision?&rdquo;</li>
                </ul>
              </div>
            </div>
          </Section>

          {/* Reversed Cards */}
          <Section title="Reversed Cards" symbol="⚝">
            <div
              className="space-y-4 text-[#e6d5b8]/90 leading-relaxed"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              <p className="text-lg sm:text-xl">
                When a card appears reversed (upside-down), it carries a special
                significance. Reversed cards are{" "}
                <span className="text-[#d4af37]">advice cards</span> - they
                indicate areas of imbalance that require your attention.
              </p>
              <p className="text-lg sm:text-xl">
                A reversed card suggests one of two things: either you need to{" "}
                <span className="text-[#d4af37]">strengthen the positive qualities</span>{" "}
                the card represents, or you need to{" "}
                <span className="text-[#d4af37]">release the negative patterns</span>{" "}
                associated with it.
              </p>
              <p className="text-lg sm:text-xl">
                For example, The Emperor reversed might suggest you either need
                to establish more structure and discipline in your life, or that
                you&apos;re being too rigid and controlling. The context of your
                question and your intuition will guide you to the correct
                interpretation.
              </p>
              <p className="text-lg sm:text-xl italic text-[#e6d5b8]/70">
                Think of reversed cards not as &ldquo;bad&rdquo; omens, but as
                helpful signposts pointing toward areas of growth and
                transformation.
              </p>
            </div>
          </Section>

          {/* Significators */}
          <Section title="Significators" symbol="⚝">
            <div
              className="space-y-4 text-[#e6d5b8]/90 leading-relaxed"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              <p className="text-lg sm:text-xl">
                Significators are cards that{" "}
                <span className="text-[#d4af37]">represent you personally</span>{" "}
                based on your birth date. When these cards appear in a reading,
                they carry special significance - the message is speaking directly
                to your core self, your life path, or your current cycles.
              </p>
              <p className="text-lg sm:text-xl">
                Your personal significators include your{" "}
                <span className="text-[#d4af37]">Day Number card</span> (derived
                from your birth day), your{" "}
                <span className="text-[#d4af37]">Astrological Sign card</span>{" "}
                (the Major Arcana connected to your sun sign), your{" "}
                <span className="text-[#d4af37]">Life Number cards</span>{" "}
                (sharing your numerological root), and your{" "}
                <span className="text-[#d4af37]">Decanate card</span> (a Minor
                Arcana card linked to the 10-day period of your birth).
              </p>
              <p className="text-lg sm:text-xl">
                When one of your significators appears in a spread, pay close
                attention. The universe is highlighting something essential
                about your identity, your destiny, or the way your personal
                energy is influencing the situation at hand.
              </p>
              <div className="mt-6 p-4 border border-[#d4af37]/30 rounded-lg bg-[#1a0033]/50">
                <p
                  className="text-[#d4af37]/80 text-sm uppercase tracking-widest mb-2"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  Discover Your Significators
                </p>
                <p className="text-[#e6d5b8]/80">
                  Visit the{" "}
                  <Link
                    href="/significators"
                    className="text-[#d4af37] hover:text-[#ffd700] underline underline-offset-2 transition-colors"
                  >
                    Significators page
                  </Link>{" "}
                  to reveal your personal cards based on your birth date.
                </p>
              </div>
            </div>
          </Section>

          {/* Reading as a Whole */}
          <Section title="Reading as a Whole" symbol="☉">
            <div
              className="space-y-4 text-[#e6d5b8]/90 leading-relaxed"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              <p className="text-lg sm:text-xl">
                While each card carries its own meaning, the true art of Tarot
                lies in reading the cards as a unified narrative. The cards
                influence and illuminate each other - their meanings shift and
                deepen based on their relationships within the spread.
              </p>
              <p className="text-lg sm:text-xl">
                Look for patterns: Do multiple cards share the same suit or
                element? Are there recurring numbers or themes? These
                connections reveal the underlying currents of your reading.
              </p>
              <p className="text-lg sm:text-xl">
                Pay attention to the story that emerges. The positions in your
                spread create a framework - past, present, future; situation,
                challenge, advice - but the cards themselves weave together into
                something greater than the sum of their parts.
              </p>
              <p className="text-lg sm:text-xl text-[#d4af37]/90">
                Trust your intuition. The meanings provided are guides, not
                rigid definitions. What speaks to you? What catches your
                attention? Your inner oracle knows which messages are meant for
                you.
              </p>
            </div>
          </Section>

          {/* Final wisdom */}
          <div className="text-center mt-12 mb-8">
            <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#d4af37]/50 to-transparent mx-auto mb-6" />
            <p
              className="text-lg sm:text-xl text-[#e6d5b8]/80 italic max-w-2xl mx-auto"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              &ldquo;The Tarot is a mirror, reflecting back to us the wisdom we
              already carry within. The cards do not tell us what will
              happen - they show us who we are and who we might become.&rdquo;
            </p>
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <Link
              href="/reading"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-lg
                        border border-[#d4af37]/40 bg-gradient-to-r from-[#d4af37]/10 to-transparent
                        hover:border-[#d4af37] hover:bg-[#d4af37]/20
                        transition-all duration-500"
            >
              <span
                className="text-sm text-[#d4af37] tracking-widest uppercase
                           hover:text-[#ffd700] transition-colors"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Consult the Oracle
              </span>
              <span className="text-xl text-[#d4af37]">→</span>
            </Link>
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
      </div>
    </main>
  );
}
